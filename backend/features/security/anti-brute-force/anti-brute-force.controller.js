// backend/features/security/anti-brute-force/anti-brute-force.controller.js
import antiBruteForceDTO from './anti-brute-force.dto.js';
import antiBruteForceService from './anti-brute-force.service.js';

const antiBruteForceController = {
  /**
   * Khusus Memvalidasi kelayakan request penginputan OTP stasiun kerja baru (Untuk IPC Electron)
   * SINKRONISASI PONDASI: Ditambahkan opsi clientKey untuk memisahkan pelacakan memori per perangkat
   */
  evaluateAttempt: (rawPayload, clientKey = 'local_device') => {
    const timestamp = new Date().toISOString();
    const safeKey = String(clientKey).trim();

    console.log(`[ANTI_BRUTE_CONTROLLER] [${timestamp}] Memulai evaluasi ambang batas OTP untuk aktor: [${safeKey}]`);

    // Gunakan fungsi pengecekan khusus rumpun OTP agar terisolasi sempurna berdasarkan kunci aktor
    const status = antiBruteForceService.checkOtpLockoutStatus(safeKey);
    if (status.isLocked) {
      console.warn(`[ANTI_BRUTE_CONTROLLER_WARN] [${timestamp}] Request OTP ditolak. Aktor [${safeKey}] sedang dalam masa hukuman.`);
      return { 
        allowed: false, 
        error: `Fitur otorisasi perangkat dibekukan. Sisa waktu: ${status.remainingTime} menit.` 
      };
    }

    const sanitized = antiBruteForceDTO.transformInput(rawPayload);

    // SINKRONISASI LOGIKA: Validasi format tidak boleh langsung memicu pengurangan sisa tebakan brute-force 
    // agar tidak terjadi pengurangan ganda (double penalty) saat dicek ulang di level database repository.
    if (!sanitized.activationCode || !/^\d{6}$/.test(sanitized.activationCode)) {
      console.warn(`[ANTI_BRUTE_CONTROLLER_WARN] [${timestamp}] Input OTP dari aktor [${safeKey}] melanggar format 6 digit angka.`);
      return { allowed: false, error: `Format kode wajib 6 digit angka murni!` };
    }
    
    return { allowed: true, code: sanitized.activationCode };
  },

  /**
   * Menangani hasil pengujian database untuk mereset atau menambah akumulasi kesalahan (Untuk IPC Electron)
   */
  handleDatabaseResult: (dbResponse, clientKey = 'local_device') => {
    const timestamp = new Date().toISOString();
    const safeKey = String(clientKey).trim();

    if (dbResponse && dbResponse.success) {
      console.log(`[ANTI_BRUTE_CONTROLLER_SUCCESS] [${timestamp}] Verifikasi OTP sukses. Reset tracker untuk aktor: [${safeKey}]`);
      antiBruteForceService.resetOtpTracker(safeKey);
      return dbResponse;
    }

    console.warn(`[ANTI_BRUTE_CONTROLLER_WARN] [${timestamp}] Verifikasi database menyatakan OTP salah/inkonsisten untuk aktor: [${safeKey}]`);
    const failure = antiBruteForceService.registerOtpFailedAttempt(safeKey);
    return { success: false, error: `Kode aktivasi salah atau tidak ditemukan. ${failure.message}` };
  },

  /**
   * STRATEGI VPS: Middleware / Handler Express untuk pengecekan brute force OTP jarak jauh
   * Memastikan request dari web API VPS terikat dengan aturan pembekuan yang sama
   */
  handleExpressOtpCheck: (req, res, next) => {
    const timestamp = new Date().toISOString();
    try {
      // Ambil IP asli klien remote untuk dijadikan kunci pelacakan unik (Mencegah pemblokiran global server VPS)
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown_vps_client';
      console.log(`[EXPRESS_ANTI_BRUTE_INFO] [${timestamp}] Mengecek proteksi brute-force OTP untuk IP: [${clientIp}]`);

      const rawPayload = req.body;

      // Jalankan fungsi evaluasi percobaan dengan menyuntikkan clientIp asli
      const evaluation = antiBruteForceController.evaluateAttempt(rawPayload, clientIp);

      if (!evaluation.allowed) {
        if (evaluation.error.includes('dibekukan')) {
          return res.status(429).json({ success: false, error: evaluation.error }); // 429 Too Many Requests
        }
        
        // SINKRONISASI EROR FORMAT: Jika format salah, kurangi sisa percobaan aktor secara adil di sini
        const failure = antiBruteForceService.registerOtpFailedAttempt(clientIp);
        return res.status(400).json({ success: false, error: `${evaluation.error} ${failure.message}` }); // 400 Bad Request
      }

      // Jika data valid dan tidak dalam status terblokir, simpan kode bersih ke objek request Express
      req.sanitizedOtpCode = evaluation.code;
      req.otpClientIp = clientIp; // Simpan IP untuk dibersihkan nanti di database result handler jika sukses
      
      // Lanjutkan ke handler database berikutnya (Next middleware/controller)
      if (typeof next === 'function') return next();
      
      return res.status(200).json({ success: true, message: 'Kode OTP tervalidasi aman.' });

    } catch (expressBruteError) {
      console.error(`[EXPRESS_ANTI_BRUTE_FATAL] [${timestamp}] Gangguan kritis pada endpoint OTP server Express: ${expressBruteError.message}`);
      return res.status(500).json({ 
        success: false, 
        error: 'Terjadi kegagalan sistem internal VPS pada modul pembekuan otorisasi.' 
      });
    }
  }
};

export default antiBruteForceController;
