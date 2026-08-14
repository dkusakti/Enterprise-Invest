import dbPool from '../../../../database/pool.js';

export const VerifyDeviceRepository = {
  /**
   * Mengubah status perangkat menjadi TRUE (Verified) berdasarkan kode OTP dari Admin Master (Untuk IPC & Express)
   */
  updateDeviceStatusToVerified: async (activationCode) => {
    const queryText = `
      UPDATE users_devices 
      SET is_verified = TRUE, 
          device_name = 'Stasiun Kerja (Disetujui Admin Master)', 
          activation_code = NULL 
      WHERE activation_code = $1
      RETURNING id, user_id;
    `;

    try {
      const result = await dbPool.query(queryText, [activationCode]);
      // Mengembalikan objek baris data pertama secara kaku jika berhasil diubah
      return result.rows[0] || null;
    } catch (error) {
      console.error('🚨 [VERIFY DEVICE DB ERROR]:', error.message);
      throw new Error(`PostgreSQL Error: ${error.message}`);
    }
  },

  /**
   * STRATEGI VPS: Metode pembantu ekstraksi data perangkat pasca verifikasi
   * Digunakan oleh Express untuk keperluan audit log di VPS (Siapa menyetujui siapa, perangkat apa)
   * 
   * @param {string} verifiedDeviceId - ID perangkat yang baru saja diverifikasi
   */
  fetchExpressAuditDetails: async (verifiedDeviceId) => {
    const queryText = `
      SELECT ud.id, ud.device_name, l.username 
      FROM users_devices ud
      JOIN login l ON ud.user_id = l.id
      WHERE ud.id = $1 LIMIT 1;
    `;
    try {
      const result = await dbPool.query(queryText, [verifiedDeviceId]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('🚨 [VERIFY DEVICE AUDIT DB ERROR]:', error.message);
      return null; // Mengembalikan null secara aman tanpa merusak alur Express utama
    }
  }
};
