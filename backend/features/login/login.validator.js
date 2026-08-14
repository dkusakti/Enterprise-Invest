// backend/features/login/login.validator.js
const loginValidator = {
	/**
	 * Memvalidasi format & struktur data input (Mitigasi ReDoS & Malicious Input)
	 */
	validateInput: async (payload) => {
		const timestamp = new Date().toISOString();
		
		// backend/features/login/login.validator.js
		// Ganti blok pengecekan Prototype Pollution lama dengan versi sinkronisasi mutlak ini:

		// SINKRONISASI SEKURITI: Mitigasi Prototype Pollution Terdepan yang Kompatibel dengan IPC Electron
		// Menggunakan hasOwnProperty untuk memastikan properti berbahaya tidak disuntikkan secara sengaja di body objek
		if (payload && (
			payload.hasOwnProperty('__proto__') || 
			payload.hasOwnProperty('constructor') || 
			payload.hasOwnProperty('prototype')
		)) {
			console.warn(`[VALIDATOR_WARN] [${timestamp}] Deteksi anomali: Payload mengandung properti objek ilegal (Prototype Pollution Attempt).`);
			return { isValid: false, error: 'Struktur data kiriman melanggar kebijakan keamanan.' };
		}

		
		const username = String(payload.username || '').trim();
		const password = String(payload.password || '');
		const fingerprint = String(payload.fingerprint || '').trim();
		
		if (username === '' || password === '') {
			console.warn(`[VALIDATOR_WARN] [${timestamp}] Validasi gagal: Kolom username atau password dikirim kosong.`);
			return { isValid: false, error: 'Nama pengguna dan kata sandi wajib diisi.' };
		}
		
		// SINKRONISASI UKURAN BUFFER DTO
		if (username.length > 50 || password.length > 128 || fingerprint.length > 256) {
			console.warn(`[VALIDATOR_WARN] [${timestamp}] Penolakan Buffer: Ukuran payload melanggar ambang batas maksimal RAM.`);
			return { isValid: false, error: 'Ukuran input data melanggar kebijakan keamanan sistem.' };
		}
		
		// REGEX LINIER AMAN (LOOKAHEAD): Mengizinkan alfanumerik, underscore, dan spasi tunggal di tengah tanpa ReDoS!
		const secureUsernameRegex = /^[a-zA-Z0-9_]+(?: [a-zA-Z0-9_]+)*$/;
		if (username.includes('  ') || !secureUsernameRegex.test(username)) {
			console.warn(`[VALIDATOR_WARN] [${timestamp}] Deteksi anomali: Format username "${username}" mengandung pola karakter/spasi ilegal.`);
			return { isValid: false, error: 'Nama pengguna mengandung karakter berbahaya atau format spasi salah!' };
		}
		
		return { isValid: true, error: null };
	}
};

export default loginValidator;
