import deviceBindingValidationRepository from './device-binding-validation.repository.js';
import crypto from 'crypto'; // SINKRONISASI: Memproduksi kode acak 6 digit numerik murni

const deviceBindingValidationService = {
  /**
   * Mengevaluasi apakah sidik jari hardware klien sah dan terdaftar di database
   */
  validateHardwareBinding: async (sanitizedDto) => {
    const { userId, clientFingerprint } = sanitizedDto;

    // VALIDASI KRITIS: Tolak mentah-mentah jika sidik jari kosong / manipulasi frontend
    if (!clientFingerprint || clientFingerprint === 'na' || clientFingerprint === '') {
      return { 
        isAllowed: false, 
        triggerActivation: false, 
        error: 'Akses Ditolak: Gagal membaca tanda tangan perangkat keras komputer Anda.' 
      };
    }

    try {
      // Panggil layer repository (Murni pembacaan)
      const devices = await deviceBindingValidationRepository.findDevicesByUserId(userId);
      
      // LAPIS AUTO-REGISTRATION: Jika records kosong (pasca reset total)
      if (!devices || devices.length === 0) {
        // Mengirim parameter default 'USER' sebagai penentu nama stasiun kerja awal
        await deviceBindingValidationRepository.registerPrimaryDevice(userId, clientFingerprint, 'USER');
        return { isAllowed: true, triggerActivation: false, error: null };
      }

      // SINKRONISASI LOGIKA: Cari apakah fingerprint sudah ada di database (baik terverifikasi maupun belum)
      const matchingDevice = devices.find(d => String(d.device_fingerprint).trim().toLowerCase() === clientFingerprint);

      // JIKA PERANGKAT SUDAH PERNAH TERDAFTAR (Ada di DB)
      if (matchingDevice) {
        // PERIKSA STATUS GEMBOK VERIFIKASI
        if (!matchingDevice.is_verified) {
          return { 
            isAllowed: false, 
            triggerActivation: true, // Diubah ke TRUE agar UI Express/Electron memicu form pengisian OTP
            error: 'Akses Tertahan: Perangkat baru Anda sudah terdaftar. Masukkan kode aktivasi ke Admin Master.' 
          };
        }
        // Jika sudah diverifikasi, lolos uji validasi hardware binding
        return { isAllowed: true, triggerActivation: false, error: null };
      }

      // JIKA PERANGKAT SEBENTAR-BENTAR BERBEDA / BENAR-BENAR BARU (Tidak ada di DB)
      // KONTROL KUOTA: Batasi pendaftaran perangkat baru jika total perangkat terdaftar sudah mencapai kuota maksimal 5
      if (devices.length >= 5) {
        return { isAllowed: false, triggerActivation: false, error: 'Akses Ditolak: Kuota maksimal 5 perangkat untuk akun ini telah terpenuhi.' };
      }

      // FIX SINKRONISASI ALUR: Produksi kode OTP acak 6 digit numerik murni yang sah
      const generatedCode = String(crypto.randomInt(100000, 999999));
      
      // Oper generatedCode masuk ke repositori agar tersimpan di database
      await deviceBindingValidationRepository.registerPendingDevice(userId, clientFingerprint, generatedCode);
      
      return { 
        isAllowed: false, 
        triggerActivation: true, 
        error: `Perangkat baru terdaftar. Berikan kode otorisasi ini ke Admin Master Anda: ${generatedCode.slice(0,3)}-${generatedCode.slice(3,6)}` 
      };

    } catch (error) {
      // FAIL-CLOSE UNTUK KEAMANAN: Jika database mati, kunci akses demi mencegah intrusi
      console.error('🚨 [DEVICE BINDING SERVICE FATAL ERROR]:', error.message);
      return { 
        isAllowed: false, 
        triggerActivation: false, 
        error: 'Sistem Keamanan Bermasalah: Gagal menghubungi database otorisasi hardware.' 
      };
    }
  }
};

export default deviceBindingValidationService;
