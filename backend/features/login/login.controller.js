// backend/features/login/login.controller.js
import loginValidator from './login.validator.js';
import loginDTO from './login.dto.js';
import loginService from './login.service.js';
import antiBruteForceService from '../security/anti-brute-force/anti-brute-force.service.js';
import dbPool from '../../database/pool.js'; // 🔥 IMPOR POOL UNTUK CATAT LOG MANUAL LOGIN

const loginController = {
  /**
   * HELPERS INTERNAL KAKU: Mencatat Log Khusus Otentikasi Gerbang Depan
   */
  catatAuditAuth: async (username, aksi, status) => {
    try {
      // Ambil ID user secara dinamis jika username terdaftar
      const findIdQuery = `SELECT id FROM login WHERE username = $1 LIMIT 1;`;
      const userRes = await dbPool.query(findIdQuery, [username]);
      const userId = userRes.rows[0]?.id || null;

      const queryLog = `
        INSERT INTO activity_log (user_id, username, action_name, target_table, status) 
        VALUES ($1, $2, $3, 'login', $4);
      `;
      await dbPool.query(queryLog, [userId, username || 'unknown_user', aksi, status]);
    } catch (e) {
      console.error(`[AUTH_LOG_FAILURE] Gagal mencatat log gerbang login: ${e.message}`);
    }
  },

  /**
   * Menangani request otentikasi login utama (IPC Electron & Core Logic)
   */
  handleLoginRequest: async (rawPayload, clientKey = 'local_device') => {
    const timestamp = new Date().toISOString();
    try {
      const inputUsername = String(rawPayload?.username || '').trim();
      const trackingKey = inputUsername !== '' ? `${clientKey}:${inputUsername}` : `${clientKey}:anonymous`;
      console.log(`[LOGIN_CONTROLLER_INFO] [${timestamp}] Memulai evaluasi request login untuk aktor key: [${trackingKey}]`);

      // 1. FAIL-FAST: Cek status blokir brute force per aktor/user
      const lockStatus = antiBruteForceService.checkLockoutStatus(trackingKey);
      if (lockStatus.isLocked) {
        console.warn(`[LOGIN_CONTROLLER_WARN] [${timestamp}] Percobaan login ditolak. Aktor [${trackingKey}] saat ini sedang dibekukan.`);
        await loginController.catatAuditAuth(inputUsername, 'LOGIN_ATTEMPT', 'BLOCKED_BRUTEFORCE');
        return { 
          success: false, 
          error: `Akses Dibekukan. Terlalu banyak percobaan salah! Sisa waktu: ${lockStatus.remainingTime} menit.` 
        };
      }

      // 2. Lapis Proteksi Struktur via Validator Luar
      const validation = await loginValidator.validateInput(rawPayload); 
      if (!validation.isValid) {
        console.warn(`[LOGIN_CONTROLLER_WARN] [${timestamp}] Request gagal melewati filter validasi terluar. Alasan: ${validation.error}`);
        return { success: false, error: validation.error };
      }

      // 3. Saring parameter via DTO Bersih
      const sanitizedDto = loginDTO.transformInput(rawPayload);

      // 4. Minta Layer Service mengecek kredensial Bcrypt database
      const result = await loginService.executeLogin(sanitizedDto);
      
      // 5. Akumulasi State Anti Brute Force
      if (result && result.success) {
        console.log(`[LOGIN_CONTROLLER_SUCCESS] [${timestamp}] Otentikasi sukses untuk identitas: "${sanitizedDto.username}"`);
        antiBruteForceService.resetTracker(trackingKey);
        
        // 🔥 REKAM JEJAK LOG: Sukses masuk ke sistem siber
        await loginController.catatAuditAuth(sanitizedDto.username, 'LOGIN_SUCCESS', 'SUCCESS');
        return result;
      } else {
        console.warn(`[LOGIN_CONTROLLER_WARN] [${timestamp}] Kegagalan otentikasi kredensial untuk aktor: [${trackingKey}]. Alasan internal: ${result?.error || 'Kredensial salah'}`);
        const failure = antiBruteForceService.registerFailedAttempt(trackingKey);
        
        // 🔥 REKAM JEJAK LOG: Gagal otentikasi kata sandi salah
        await loginController.catatAuditAuth(sanitizedDto.username, 'LOGIN_FAILED', 'INVALID_PASSWORD');
        
        const outputErrorReason = result?.error ? result.error : 'Kredensial yang Anda masukkan salah.';
        return { 
          success: false, 
          error: `${outputErrorReason} ${failure.message}` 
        };
      }

    } catch (globalControllerError) {
      console.error(`[LOGIN_CONTROLLER_FATAL] [${timestamp}] Kegagalan sistem tidak terduga pada core controller: ${globalControllerError.message}`);
      return { 
        success: false, 
        error: 'Kegagalan komputasi sistem internal pada pengatur alur data login.' 
      };
    }
  },

  /**
   * STRATEGI VPS: Menangani HTTP request untuk API Express
   */
  handleExpressLogin: async (req, res) => {
    const timestamp = new Date().toISOString();
    try {
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown_vps_client';
      console.log(`[EXPRESS_LOGIN_INFO] [${timestamp}] Menerima HTTP POST Login dari IP: [${clientIp}]`);

      const result = await loginController.handleLoginRequest(req.body, clientIp);

      if (!result.success) {
        if (result.error.includes('Dibekukan')) {
          return res.status(429).json(result); 
        }
        return res.status(401).json(result); 
      }

      return res.status(200).json(result);

    } catch (expressControllerError) {
      console.error(`[EXPRESS_LOGIN_FATAL] [${timestamp}] Gangguan fatal pada VPS Express Endpoint Login: ${expressControllerError.message}`);
      return res.status(500).json({ 
        success: false, 
        error: 'Terjadi kesalahan internal pada server VPS saat memproses login.' 
      });
    }
  }
};

export default loginController;
