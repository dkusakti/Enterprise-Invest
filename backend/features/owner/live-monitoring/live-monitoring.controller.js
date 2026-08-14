// backend/features/owner/live-monitoring/live-monitoring.controller.js
import liveMonitoringRepository from './live-monitoring.repository.js';

/**
 * ENTERPRISE LIVE MONITORING CONTROLLER
 * Aturan Mutlak: Memproses dan memformat data mentah DB menjadi objek siap konsumsi UI.
 */
const liveMonitoringController = {
  /**
   * Menangani permintaan sinkronisasi tabel data dari IPC (Untuk IPC Electron)
   * @returns {Promise<Object>} Respon terstruktur berisi data tabel yang sudah terpotong aman
   */
  handleTableUpdate: async () => {
    const timestamp = new Date().toISOString();
    try {
      const devices = await liveMonitoringRepository.fetchRegisteredDevices();
      
      // Pastikan data yang didapat berbentuk array untuk mencegah crash map
      const safeDevices = Array.isArray(devices) ? devices : [];

      // Lapis Data Minimization: Lakukan pemotongan sidik jari perangkat (fingerprint hash)
      const cleanDevices = safeDevices.map(device => {
        const rawHash = String(device.device_fingerprint || '');
        return {
          userId: String(device.user_id),
          deviceName: String(device.device_name),
          isVerified: Boolean(device.is_verified),
          // Memangkas sidik jari komputer mentah demi mitigasi eksploitasi visual di UI
          truncatedHash: rawHash.length > 15 ? `${rawHash.substring(0, 15)}...` : rawHash
        };
      });

      console.log(`[LIVE_MONITOR_INFO] [${timestamp}] Sukses memproses sinkronisasi tabel pemantauan stasiun kerja. Total: ${cleanDevices.length} perangkat.`);
      return { success: true, data: cleanDevices };
    } catch (error) {
      console.error(`[LIVE_MONITOR_ERROR] [${timestamp}] Kegagalan internal pada penarikan data monitoring: ${error.message}`);
      return { 
        success: false, 
        error: 'Gagal melakukan penyegaran berkala tabel infrastruktur.' 
      };
    }
  },

  /**
   * STRATEGI VPS: Menangani HTTP request untuk API Express Live Monitoring
   * Menyediakan data pemantauan real-time yang aman untuk sisi Web/Owner di VPS
   */
  handleExpressTableUpdate: async (req, res) => {
    const timestamp = new Date().toISOString();
    try {
      // Panggil fungsi logika bisnis inti yang sudah mapan
      const result = await liveMonitoringController.handleTableUpdate();

      if (!result || !result.success) {
        console.warn(`[EXPRESS_MONITOR_WARN] [${timestamp}] Pengiriman data API monitoring dibatalkan karena kendala repositori.`);
        return res.status(500).json({ 
          success: false, 
          error: result?.error || 'Gagal melakukan penyegaran berkala tabel infrastruktur.' 
        }); 
      }

      // Kirim data dengan status 200 OK
      return res.status(200).json(result);

    } catch (expressMonitorError) {
      console.error(`[EXPRESS_LIVE_MONITORING_CONTROLLER_FATAL] [${timestamp}]: ${expressMonitorError.message}`);
      return res.status(500).json({ 
        success: false, 
        error: 'Terjadi kegagalan internal pada server VPS saat memproses data monitoring.' 
      });
    }
  }
};

export default liveMonitoringController;