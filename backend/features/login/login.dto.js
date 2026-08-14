// backend/features/login/login.dto.js
const loginDTO = {
	/**
	 * Menyaring dan memetakan payload mentah menjadi objek DTO yang bersih dan kaku
	 */
	transformInput: (rawPayload) => {
		const timestamp = new Date().toISOString();
		const payload = (rawPayload && typeof rawPayload === 'object') ? rawPayload : {};

		// PENGAMANAN: Batasi panjang input maksimal untuk mencegah serangan Memory Exhaustion (DoS)
		const MAX_USERNAME_LEN = 50;
		const MAX_PASSWORD_LEN = 128;
		const MAX_FINGERPRINT_LEN = 256;

		// 1. Bersihkan Username & Hapus ASCII Control Characters
		let usernameClean = String(payload.username || '')
			.substring(0, MAX_USERNAME_LEN)
			.trim()
			.replace(/[\x00-\x1F\x7F]/g, ''); 

		// 2. Bersihkan Password (Jangan di-trim karena spasi adalah karakter valid password)
		let passwordClean = String(payload.password || '')
			.substring(0, MAX_PASSWORD_LEN);
		
		// 3. Bersihkan Fingerprint Hash
		let fingerprintClean = String(payload.fingerprint || '')
			.substring(0, MAX_FINGERPRINT_LEN)
			.replace(/\s+/g, '')
			.toLowerCase();
		
		// Log transformasi tanpa membocorkan parameter password asli
		// Ditambahkan pengaman internal jika string kosong agar pesan log tetap rapi untuk diperbaiki jika error
		const safeUserLogLen = usernameClean ? usernameClean.length : 0;
		const safePassLogLen = passwordClean ? passwordClean.length : 0;
		
		console.log(`[LOGIN_DTO_INFO] [${timestamp}] Transformasi data selesai. Panjang Username: ${safeUserLogLen}, Panjang Password Masking: ${safePassLogLen} karakter.`);
		
		return {
			username: usernameClean,
			password: passwordClean,
			fingerprint: fingerprintClean
		};
	}
};

export default loginDTO;
