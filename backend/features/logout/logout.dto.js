/**
 * ENTERPRISE LOGOUT DTO (backend/features/logout/logout.dto.js)
 * Aturan Mutlak: Hanya bertanggung jawab melakukan Data Mapping / Transformation tanpa memalsukan nilai.
 */
const logoutDTO = {
  /**
   * Memetakan dan mengunci struktur request logout secara kaku
   * @param {Object} rawPayload - Payload mentah dari IPC atau Express req.body
   * @returns {Object} Objek terstruktur kaku dengan teks huruf kapital
   */
  transformInput: (rawPayload) => {
    const timestamp = new Date().toISOString();
    
    // FIX SEKURITI: Validasi tipe objek dasar untuk mencegah crash runtime akibat manipulasi tipe data di VPS
    const payload = (rawPayload && typeof rawPayload === 'object') ? rawPayload : {};

    // PENGAMANAN SEKURITI: Batasi panjang input maksimal untuk mencegah serangan Memory Exhaustion (DoS)
    // Kata kunci yang valid hanyalah "EXECUTE_LOGOUT" (14 Karakter). Kita batasi aman di 20 karakter.
    const MAX_ACTION_LEN = 20;

    const extractedAction = String(payload.action || '').substring(0, MAX_ACTION_LEN);

    // Ambil data asli dari payload, bersihkan spasi, dan paksa jadi HURUF KAPITAL murni
    const cleanAction = extractedAction.trim().toUpperCase();

    // Log transformasi data tanpa membocorkan info sensitif untuk mempermudah perbaikan jika terjadi kendala
    console.log(`[LOGOUT_DTO_INFO] [${timestamp}] Transformasi klaim data logout selesai. Panjang string aksi: ${cleanAction.length} karakter.`);

    return {
      action: cleanAction
    };
  }
};

export default logoutDTO;
