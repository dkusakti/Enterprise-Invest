import deviceBindingValidationDTO from './device-binding-validation.dto.js';
import deviceBindingValidationService from './device-binding-validation.service.js';

/**
 * ENTERPRISE DEVICE BINDING VALIDATION CONTROLLER
 */
const deviceBindingValidationController = {
  /**
   * Menangani intersepsi pencegatan sidik jari saat proses jabat tangan login (Untuk IPC Electron)
   * @param {Object} rawPayload - Data objek mentah { userId, fingerprint }
   * @returns {Promise<Object>} Keputusan akhir mutlak status keamanan perangkat keras
   */
  verifyClientDevice: async (rawPayload) => {
    try {
      // 1. Saring struktur input via tameng DTO
      const sanitizedDto = deviceBindingValidationDTO.transformBindingInput(rawPayload);

      // 2. Lempar ke layer service untuk dinilai berdasarkan record PostgreSQL
      const decision = await deviceBindingValidationService.validateHardwareBinding(sanitizedDto);
      return decision;

    } catch (globalControllerError) {
      console.error('🚨 [DEVICE BINDING CONTROLLER CRITICAL ERROR]:', globalControllerError.message);
      
      // FIX MUTLAK (FAIL-CLOSED): Kunci total akses masuk jika infrastruktur komputasi mengalami gangguan!
      return { 
        isAllowed: false, 
        triggerActivation: false, 
        error: 'Sistem keamanan internal gagal memverifikasi integritas stasiun kerja Anda.' 
      };
    }
  },

  /**
   * STRATEGI VPS: Menangani HTTP request untuk API Express Device Binding Validation
   * Digunakan sebagai pos pemeriksaan validasi gembok hardware jarak jauh di VPS
   */
  handleExpressDeviceCheck: async (req, res) => {
    try {
      // Ambil payload mentah dari body HTTP request
      const rawPayload = req.body;

      // Jalankan fungsi logika inti yang sudah teruji stabil
      const decision = await deviceBindingValidationController.verifyClientDevice(rawPayload);

      if (!decision.isAllowed) {
        // Jika diblokir karena kuota penuh atau stasiun kerja tidak sah, kembalikan status 403 Forbidden
        return res.status(403).json(decision);
      }

      // Jika disetujui, kembalikan status 200 OK beserta keputusan data dari service
      return res.status(200).json(decision);

    } catch (expressBindingError) {
      console.error('🚨 [EXPRESS DEVICE BINDING CONTROLLER FATAL]:', expressBindingError.message);
      return res.status(500).json({ 
        isAllowed: false, 
        triggerActivation: false, 
        error: 'Terjadi kegagalan internal pada server VPS saat memverifikasi gembok hardware.' 
      });
    }
  }
};

export default deviceBindingValidationController;
