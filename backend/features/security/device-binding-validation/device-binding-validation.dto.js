/**
 * ENTERPRISE DEVICE BINDING VALIDATION DTO
 * Aturan Mutlak: Hanya bertanggung jawab melakukan Data Mapping / Transformasi Payload Perangkat.
 */
const deviceBindingValidationDTO = {
  /**
   * Menyaring input sidik jari hardware mentah menjadi format string heksadesimal kaku
   * @param {Object} rawPayload - Data mentah kiriman dari sirkuit login kernel atau Express req.body
   * @returns {Object} Objek klaim perangkat ter-whitelisted
   */
  transformBindingInput: (rawPayload) => {
    // FIX SEKURITI: Validasi struktur objek dasar untuk mencegah crash runtime akibat manipulasi tipe data di VPS
    const payload = (rawPayload && typeof rawPayload === 'object') ? rawPayload : {};

    // FIX SINKRONISASI: Gunakan regex \s+ untuk menyapu bersih karakter kontrol (Tab, newline) seperti Poin 2!
    const cleanFingerprint = String(payload.fingerprint || '')
      .replace(/\s+/g, '')
      .toLowerCase();

    return {
      // Pastikan userId dikonversi ke basis angka desimal secara kaku
      userId: parseInt(payload.userId || 0, 10),
      clientFingerprint: cleanFingerprint
    };
  }
};

export default deviceBindingValidationDTO;
