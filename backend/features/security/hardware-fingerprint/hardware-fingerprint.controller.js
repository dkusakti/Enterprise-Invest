import hardwareFingerprintService from './hardware-fingerprint.service.js';
import hardwareFingerprintDTO from './hardware-fingerprint.dto.js';

/**
 * ENTERPRISE HARDWARE FINGERPRINT CONTROLLER
 * Aturan Mutlak: Konduktor linear yang mengisolasi kegagalan pembacaan child_process OS.
 */
const hardwareFingerprintController = {
  /**
   * Menangani request pengambilan sidik jari mesin lokal untuk dikonsumsi runtime kernel (Untuk IPC Electron Lokal)
   * @returns {Object} Hasil enkripsi sidik jari perangkat keras yang aman
   */
  getSecureFingerprint: () => {
    try {
      // 1. Ambil data mesin murni dari service lewat pembacaan shell OS
      const rawHash = hardwareFingerprintService.getMachineId();
      
      // 2. Saring via DTO terpisah agar aman dari manipulasi tipe data dan spasi kontrol
      const sanitizedOutput = hardwareFingerprintDTO.transformOutput(rawHash);
      
      return { success: true, data: sanitizedOutput };
    } catch (globalControllerError) {
      console.error('🚨 [HARDWARE FINGERPRINT CONTROLLER ERROR]:', globalControllerError.message);
      
      // Fail-safe mutlak (Fail-Closed) jika shell Linux Parrot OS mendadak corrupt atau terkunci privilege
      return { 
        success: false, 
        error: 'Gagal mengeksekusi ekstraksi tanda tangan keras perangkat.' 
      };
    }
  },

  /**
   * STRATEGI VPS: Menangani HTTP request untuk API Express Hardware Fingerprint
   * Bertindak sebagai penerima sidik jari yang dikirimkan oleh aplikasi klien (Web/Desktop Klien)
   */
  handleExpressFingerprintCheck: (req, res) => {
    try {
      // Di VPS, kita menerima sidik jari dari body request kiriman klien, bukan membaca mesin VPS
      const clientRawHash = req.body?.fingerprint;

      if (!clientRawHash) {
        return res.status(400).json({ 
          success: false, 
          error: 'Sidik jari perangkat keras dari klien tidak terlampir.' 
        });
      }

      // Saring data kiriman via DTO agar formatnya sinkron, kaku, dan bebas spasi kontrol
      const sanitizedOutput = hardwareFingerprintDTO.transformOutput(clientRawHash);

      return res.status(200).json({ 
        success: true, 
        data: sanitizedOutput 
      });

    } catch (expressFingerprintError) {
      console.error('🚨 [EXPRESS HARDWARE FINGERPRINT CONTROLLER FATAL]:', expressFingerprintError.message);
      return res.status(500).json({ 
        success: false, 
        error: 'Terjadi kegagalan internal pada server VPS saat memvalidasi tanda tangan perangkat.' 
      });
    }
  }
};

export default hardwareFingerprintController;
