// backend/features/owner/reset-hardware/reset-hardware.repository.js
import dbPool from '../../../database/pool.js';

/**
 * ENTERPRISE RESET HARDWARE REPOSITORY
 * Aturan Mutlak: Hanya mengeksekusi perintah penghancuran data kaku ke PostgreSQL.
 */
const resetHardwareRepository = {
  /**
   * Mengosongkan total seluruh isi tabel penguncian perangkat karyawan (Untuk IPC Electron & Express)
   * @returns {Promise<Object>} Status sukses kueri
   */
  executeGlobalTruncate: async () => {
    const timestamp = new Date().toISOString();
    // Kueri kaku PostgreSQL untuk menyapu bersih data dari nol dan mereset nomor ID serial awal
    const sqlText = 'TRUNCATE TABLE users_devices RESTART IDENTITY CASCADE;';

    try {
      await dbPool.query(sqlText);
      console.log(`[RESET_DB_SUCCESS] [${timestamp}] Perintah TRUNCATE CASCADE sukses dieksekusi ke PostgreSQL.`);
      return { success: true };
    } catch (error) {
      console.error(`[CRITICAL_RESET_DB_ERROR] [${timestamp}]: ${error.message}`);
      throw new Error('PostgreSQL execution failure during emergency truncate operations.');
    }
  },

  /**
   * STRATEGI VPS: Mengeksekusi TRUNCATE dengan validasi string konfirmasi rahasia
   * Melindungi VPS Production dari penghancuran data tidak sengaja akibat salah klik di Web Admin.
   * 
   * @param {string} serverConfirmationPhrase - String penegasan yang dikirim dari controller Express
   */
  executeExpressGlobalTruncate: async (serverConfirmationPhrase) => {
    const timestamp = new Date().toISOString();
    // TAMENG VPS: Wajibkan frasa konfirmasi yang kaku untuk memastikan aksi ini disengaja oleh admin
    const cleanPhrase = String(serverConfirmationPhrase || '').trim();
    
    // SINKRONISASI SEKURITI: Hapus total fallback hardcoded string teks biasa demi mitigasi Unauthorized Database Wipeout
    if (!process.env.DB_TRUNCATE_CONFIRM_KEY || process.env.DB_TRUNCATE_CONFIRM_KEY.trim() === '') {
      console.error(`[RESET_DB_CRITICAL_ERROR] [${timestamp}] Kunci DB_TRUNCATE_CONFIRM_KEY tidak terdefinisi di file .env VPS! Menolak seluruh akses wipeout database.`);
      return { 
        success: false, 
        error: 'PENGHANCURAN DIBATALKAN: Sistem keamanan konfigurasi server tidak memadai!' 
      };
    }

    const expectedPhrase = process.env.DB_TRUNCATE_CONFIRM_KEY.trim();

    if (cleanPhrase !== expectedPhrase) {
      console.warn(`[RESET_DB_WARN] [${timestamp}] Gagal melakukan pembersihan data. Frasa konfirmasi salah atau tidak cocok.`);
      return { 
        success: false, 
        error: 'PENGHANCURAN DIBATALKAN: Frasa konfirmasi keamanan VPS tidak cocok!' 
      };
    }

    // Jika lolos verifikasi frasa rahasia, panggil fungsi truncate utama Anda yang stabil
    return await resetHardwareRepository.executeGlobalTruncate();
  }
};

export default resetHardwareRepository;
