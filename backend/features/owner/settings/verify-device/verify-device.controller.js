// backend/features/owner/settings/verify-device/verify-device.controller.js
import { VerifyDeviceService } from './verify-device.service.js';

export const VerifyDeviceController = {
  /**
   * Menangani input kode aktivasi dari panel pengaturan Admin Master (Untuk IPC Electron Lokal)
   * @param {Object} payload - Objek input berisi parameter code OTP dari frontend
   * @returns {Promise<Object>} Respon status final untuk dikembalikan ke UI
   */
  handle: async (payload) => {
    const timestamp = new Date().toISOString();
    try {
      // Saring ketat masukan kode aktivasi (Mitigasi Null Pointer Exception)
      if (!payload || typeof payload !== 'object' || !payload.code) {
        console.warn(`[VERIFY_DEVICE_WARN] [${timestamp}] Input otorisasi ditolak. Format payload tidak lengkap atau kosong.`);
        return { status: 'error', message: 'Kode aktivasi wajib diisi dengan format objek yang benar!' };
      }

      const cleanCode = String(payload.code).trim();
      console.log(`[VERIFY_DEVICE_INFO] [${timestamp}] Meneruskan instruksi pembukaan gembok hardware ke lapisan service.`);

      // Teruskan ke lapisan service untuk eksekusi pembukaan gembok database
      return await VerifyDeviceService.approveClientDevice(cleanCode);

    } catch (error) {
      console.error(`[VERIFY_DEVICE_ERROR] [${timestamp}] Kegagalan pada alur eksekusi handle controller: ${error.message}`);
      return { status: 'error', message: 'Gagal memproses otorisasi di tingkat kontroler.' };
    }
  },

  /**
   * STRATEGI VPS: Menangani HTTP request untuk API Express Verify/Approve Device
   * Membungkus fungsi validasi internal dan memberikan respon HTTP JSON yang terstandarisasi.
   */
  handleExpressVerify: async (req, res) => {
    const timestamp = new Date().toISOString();
    try {
      // Ambil objek payload langsung dari HTTP request body
      const payload = req.body || {};

      // Jalankan fungsi logika utama yang sudah stabil
      const result = await VerifyDeviceController.handle(payload);

      // Sinkronisasi status respon untuk menentukan HTTP status code yang tepat
      if (result && result.status === 'error') {
        console.warn(`[EXPRESS_VERIFY_WARN] [${timestamp}] Permintaan API persetujuan perangkat gagal diproses server Express.`);
        
        // Bersihkan objek respon kegagalan agar seragam dan aman dari resiko kebocoran skema DB internal
        const secureOutputMessage = result?.message || 'Gagal memproses otorisasi di tingkat kontroler.';
        
        // Cek jika error dikarenakan pembekuan akses brute force (jika ada di tingkat service)
        if (secureOutputMessage.includes('DIBEKUKAN') || secureOutputMessage.includes('Akses Dibekukan')) {
          return res.status(429).json({ status: 'error', message: secureOutputMessage }); // 429 Too Many Requests
        }
        return res.status(400).json({ status: 'error', message: secureOutputMessage }); // 400 Bad Request untuk kegagalan input/validasi
      }

      console.log(`[EXPRESS_VERIFY_SUCCESS] [${timestamp}] Gembok stasiun kerja baru berhasil dibuka secara aman melalui API VPS.`);
      return res.status(200).json(result); // Jika berhasil, kembalikan status 200 OK beserta data dari service

    } catch (expressVerifyError) {
      console.error(`[EXPRESS_VERIFY_DEVICE_CONTROLLER_FATAL] [${timestamp}]: ${expressVerifyError.message}`);
      return res.status(500).json({ 
        status: 'error', 
        message: 'Terjadi kegagalan internal pada server VPS saat memproses verifikasi perangkat.' 
      });
    }
  }
};
