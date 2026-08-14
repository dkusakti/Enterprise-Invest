/**
 * ENTERPRISE ANTI-BRUTE-FORCE DTO (backend/features/security/anti-brute-force/anti-brute-force.dto.js)
 * Aturan Mutlak: Hanya bertanggung jawab melakukan Data Mapping / Transformation tanpa memalsukan nilai.
 */
const antiBruteForceDTO = {
	/**
	 * Memetakan dan membersihkan payload kode aktivasi dari karakter visual pengganggu
	 * @param {Object} rawPayload - Payload mentah dari IPC atau Express req.body
	 * @returns {Object} Objek terstruktur berisi kode aktivasi bersih
	 */
	transformInput: (rawPayload) => {
		const timestamp = new Date().toISOString();
		
		// FIX SEKURITI: Proteksi tipe objek dasar untuk mencegah crash runtime akibat manipulasi tipe data di VPS
		const payload = (rawPayload && typeof rawPayload === 'object') ? rawPayload : {};

		// PENGAMANAN SEKURITI: Batasi panjang input maksimal untuk mencegah serangan Memory Exhaustion (DoS)
		// Kode OTP normal (6 digit) maksimal hanya 7 karakter termasuk strip (contoh: 123-456). Kita batasi aman di 10 karakter.
		const MAX_OTP_LEN = 10;

		const extractedCode = String(payload.code || '').substring(0, MAX_OTP_LEN);

		// Bersihkan seluruh tanda strip visual sekaligus secara global dan paksa menjadi tipe String murni
		const cleanActivationCode = extractedCode.replace(/-/g, '').trim();

		// Log aktivitas transformasi tanpa membocorkan isi kode OTP asli untuk mempermudah perbaikan jika terjadi kendala
		console.log(`[ANTI_BRUTE_DTO_INFO] [${timestamp}] Transformasi data OTP selesai. Panjang input bersih: ${cleanActivationCode.length} karakter.`);

		return {
			activationCode: cleanActivationCode 
		};
	}
};

export default antiBruteForceDTO;
