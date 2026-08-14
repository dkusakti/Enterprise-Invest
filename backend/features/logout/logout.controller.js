// backend/features/logout/logout.controller.js
import logoutDTO from './logout.dto.js';
import dbPool from '../../database/pool.js'; // 🔥 IMPOR POOL UNTUK CATAT LOG LOGOUT MANUAL

const logoutController = {
  /**
   * Memvalidasi request logout sebelum mengeksekusi penghancuran sesi di kernel
   */
  validateLogoutRequest: (rawPayload = {}) => {
    try {
      const sanitized = logoutDTO.transformInput(rawPayload);

      if (sanitized.action !== 'EXECUTE_LOGOUT') {
        return { allowed: false, error: 'Klaim aksi pembersihan ilegal!' };
      }

      return { allowed: true };
    } catch (error) {
      return { allowed: false, error: 'Gagal memproses validasi logout.' };
    }
  },

  /**
   * STRATEGI VPS: Menangani HTTP request untuk API Express Logout
   */
  handleExpressLogout: async (req, res) => {
    const timestamp = new Date().toISOString();
    try {
      const rawPayload = req.body || {};
      const validation = logoutController.validateLogoutRequest(rawPayload);
      
      if (!validation.allowed) {
        console.warn(`[EXPRESS_LOGOUT_WARN] [${timestamp}] Percobaan hit API logout ditolak karena klaim payload malformed.`);
        return res.status(400).json({ success: false, error: validation.error });
      }

      // 🔥 REKAM JEJAK LOG LOGOUT VPS
      try {
        const queryLog = `INSERT INTO activity_log (user_id, username, action_name, target_table, status) VALUES ($1, $2, 'LOGOUT', 'login', 'SUCCESS');`;
        await dbPool.query(queryLog, [req.user?.id || null, req.user?.username || 'vps_client']);
      } catch (e) {}

      res.clearCookie('token'); 
      console.log(`[EXPRESS_LOGOUT_SUCCESS] [${timestamp}] Sesi JWT/Cookie pengguna sukses dihancurkan dari endpoint VPS.`);

      return res.status(200).json({ 
        success: true, 
        message: 'Sesi VPS berhasil dihancurkan. Logout sukses.' 
      });

    } catch (expressLogoutError) {
      console.error(`[EXPRESS_LOGOUT_CONTROLLER_FATAL] [${timestamp}]: ${expressLogoutError.message}`);
      return res.status(500).json({ 
        success: false, 
        error: 'Terjadi kesalahan sistem internal VPS saat memproses logout.' 
      });
    }
  }
};

export default logoutController;
