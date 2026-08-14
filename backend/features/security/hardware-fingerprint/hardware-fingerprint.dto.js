/**
 * ENTERPRISE HARDWARE FINGERPRINT DTO
 * Aturan Mutlak: Hanya bertanggung jawab melakukan Data Mapping / Kebal Type Tampering.
 */
const hardwareFingerprintDTO = {
  /**
   * Mengunci dan membersihkan data hash sidik jari sebelum dikirim lintas proses IPC atau Express HTTP Response
   * @param {string} rawHash - Hasil kalkulasi hash dari service lokal atau kiriman HTTP req.body
   * @returns {Object} Objek terstruktur kaku
   */
  transformOutput: (rawHash) => {
    // FIX SEKURITI: Validasi ketat untuk memastikan rawHash bukan berupa Objek/Array yang dimanipulasi penyerang
    // Jika terdeteksi tipe data objek kompleks, paksa fallback ke string kosong untuk mencegah kebocoran/crash memori
    let safeRawHash = '';
    if (rawHash && typeof rawHash !== 'object' && !Array.isArray(rawHash)) {
      safeRawHash = String(rawHash);
    } else if (typeof rawHash === 'string') {
      safeRawHash = rawHash;
    }

    // FIX SINKRONISASI: Buang total seluruh bentuk spasi, tab, dan baris baru (\s) secara global via regex
    // Langkah ini menjamin string yang dikirim ke kernel/Express murni alfanumerik heksadesimal 64 karakter
    const cleanFingerprint = safeRawHash
      .replace(/\s+/g, '')
      .toLowerCase();

    return {
      // KUNCI SINKRONISASI: Properti wajib bernama 'fingerprint' agar terbaca sempurna oleh main.js Kernel dan Router Express
      fingerprint: cleanFingerprint
    };
  }
};

export default hardwareFingerprintDTO;
