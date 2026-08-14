import dbPool from '../../../database/pool.js';

const deviceBindingValidationRepository = {
  /**
   * Mengambil semua perangkat terikat berdasarkan ID Pengguna (Untuk IPC & Express)
   */
  findDevicesByUserId: async (userId) => {
    const sqlText = 'SELECT id, user_id, device_fingerprint, is_verified FROM users_devices WHERE user_id = $1;';
    try {
      const result = await dbPool.query(sqlText, [userId]);
      return result.rows;
    } catch (error) {
      console.error('🚨 [BINDING REP ERROR - FETCH]:', error.message);
      throw error;
    }
  },

  /**
   * Mendaftarkan stasiun kerja utama (Auto-Registration - Untuk IPC & Express)
   */
  registerPrimaryDevice: async (userId, fingerprint, userRole = 'USER') => {
    // SINKRONISASI VISUAL: Nama perangkat disesuaikan dengan peran pengguna seperti pada Poin 5
    const dynamicName = `Stasiun Kerja (${String(userRole).toUpperCase()})`;
    const insertSql = `
      INSERT INTO users_devices (user_id, device_fingerprint, device_name, is_verified) 
      VALUES ($1, $2, $3, true) RETURNING id;
    `;
    try {
      const result = await dbPool.query(insertSql, [userId, fingerprint, dynamicName]);
      // SINKRONISASI LAYER: Kembalikan objek baris pertama secara kaku untuk kestabilan pembacaan ID
      return result.rows[0] || null;
    } catch (error) {
      console.error('🚨 [BINDING REP ERROR - INSERT PRIMARY]:', error.message);
      throw error;
    }
  },

  /**
   * Mendaftarkan perangkat baru berstatus tertahan (Pending) dengan kode aktivasi (Untuk IPC & Express)
   */
  registerPendingDevice: async (userId, fingerprint, generatedCode) => {
    // SINKRONISASI ALUR: Masukkan generatedCode OTP agar sesuai dengan skema DBeaver Anda!
    const insertNewSql = `
      INSERT INTO users_devices (user_id, device_fingerprint, device_name, is_verified, activation_code) 
      VALUES ($1, $2, 'Perangkat Baru (Pending)', false, $3) RETURNING id;
    `;
    try {
      const result = await dbPool.query(insertNewSql, [userId, fingerprint, generatedCode]);
      // SINKRONISASI LAYER: Kembalikan objek baris pertama secara kaku untuk kestabilan pembacaan ID
      return result.rows[0] || null;
    } catch (error) {
      console.error('🚨 [BINDING REP ERROR - INSERT PENDING]:', error.message);
      throw error;
    }
  }
};

export default deviceBindingValidationRepository;
