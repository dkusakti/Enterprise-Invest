// backend/features/owner/reset-hardware/reset-hardware.controller.js
import resetHardwareRepository from './reset-hardware.repository.js';

const resetHardwareController = {
  /**
   * Menangani instruksi reset dari saluran IPC kernel dengan verifikasi otoritas berlapis
   */
  processEmergencyReset: async (requestContext) => {
    const timestamp = new Date().toISOString();
    try {
      // 1. 🔒 SEKURITI LAPIS HILIR: Normalisasi dan kunci hak akses hanya untuk Owner & AdminMaster
      const userRole = String(requestContext?.role || '').trim().toLowerCase().replace(/\s+/g, '');
      
      if (userRole !== 'owner' && userRole !== 'adminmaster') {
        console.warn(`[RESET_HARDWARE_WARN] [${timestamp}] Percobaan reset hardware ilegal ditolak. Peran pengirim: "${userRole}"`);
        return { 
          success: false, 
          error: 'AKSES DITOLAK: Anda tidak memiliki otoritas tertinggi untuk menghapus data hardware!' 
        };
      }

      // 2. SINKRONISASI FRASA: Tangkap frasa konfirmasi yang dikirim dari input UI
      const userTypedPhrase = String(requestContext?.confirmationPhrase || '').trim();

      console.log(`[RESET_HARDWARE_INFO] [${timestamp}] Otoritas valid. Meneruskan pemeriksaan frasa keamanan ke tingkat repositori.`);
      
      // Jalankan kueri penghancuran dengan melempar frasa rahasia ke fungsi verifikasi di repository
      const result = await resetHardwareRepository.executeExpressGlobalTruncate(userTypedPhrase);
      return result;

    } catch (error) {
      console.error(`[RESET_HARDWARE_ERROR] [${timestamp}] Kegagalan pada alur eksekusi processEmergencyReset: ${error.message}`);
      return { 
        success: false, 
        error: 'Kegagalan komputasi sistem internal pada pengosongan database.' 
      };
    }
  },

  /**
   * STRATEGI VPS: Menangani HTTP request untuk API Express Reset Hardware
   */
  handleExpressEmergencyReset: async (req, res) => {
    const timestamp = new Date().toISOString();
    try {
      // PERTAHANAN ABSOLUT VPS: Mengambil payload identitas yang sudah terverifikasi oleh middleware JWT Sesi server
      const requestContext = {
        role: req.user?.role || '',
        confirmationPhrase: req.body?.confirmationPhrase || '' // Ambil frasa ketikan HP/Web dari request body
      };

      const result = await resetHardwareController.processEmergencyReset(requestContext);

      if (!result || !result.success) {
        console.warn(`[EXPRESS_RESET_WARN] [${timestamp}] Permintaan API reset ditolak murni karena ketidakcocokan hak akses/token rahasia.`);
        return res.status(403).json({
          success: false,
          error: result?.error || 'Akses ditolak.'
        }); 
      }

      console.log(`[EXPRESS_RESET_SUCCESS] [${timestamp}] Seluruh tabel data hardware stasiun kerja sukses dikosongkan via API Express.`);
      return res.status(200).json(result);

    } catch (expressResetError) {
      console.error(`[EXPRESS_RESET_HARDWARE_FATAL] [${timestamp}]: ${expressResetError.message}`);
      return res.status(500).json({ 
        success: false, 
        error: 'Terjadi kegagalan internal server VPS saat mengeksekusi perintah penghancuran data.' 
      });
    }
  }
};

export default resetHardwareController;
