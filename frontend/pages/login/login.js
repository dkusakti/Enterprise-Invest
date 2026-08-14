/**
 * ENTERPRISE INTERACTION CONTROLLER (frontend/pages/login/login.js)
 * Aturan Mutlak: Murni mengelola interaksi DOM dan komunikasi via Context Bridge.
 */
document.addEventListener('DOMContentLoaded', () => {
	
	// Tangkap seluruh komponen DOM murni dari login.html
	const loginForm = document.getElementById('loginForm');
	const usernameInput = document.getElementById('usernameInput');
	const passwordInput = document.getElementById('passwordInput');
	const eyeToggleBtn = document.getElementById('eyeToggleBtn');
	const submitBtn = document.getElementById('submitBtn');
	const authStatusMessage = document.getElementById('authStatusMessage');
	
	let isSubmitting = false;

	/**
	 * 1. FUNGSI INTERACTION: Fitur Intip / Sembunyikan Kata Sandi
	 */
	if (eyeToggleBtn && passwordInput) {
		eyeToggleBtn.addEventListener('click', () => {
			const svgIcon = eyeToggleBtn.querySelector('svg path');
			if (passwordInput.type === 'password') {
				passwordInput.type = 'text';
				if (svgIcon) svgIcon.setAttribute('fill', '#00ffcc'); // Ubah warna ikon saat diintip
			} else {
				passwordInput.type = 'password';
				if (svgIcon) svgIcon.setAttribute('fill', '#64748b');
			}
		});
	}
	
	/**
	 * 2. FUNGSI AUTENTIKASI: Intersepsi Submit Form & Pengiriman Data Linier (Async First)
	 */
	if (loginForm) {
		loginForm.addEventListener('submit', async (event) => {
			const timestamp = new Date().toISOString();
			// Hentikan muat ulang halaman bawaan browser
			event.preventDefault();
			
			// Mitigasi Race Condition / Double Click
			if (isSubmitting) return;
			
			const usernameValue = usernameInput ? usernameInput.value.trim() : '';
			const passwordValue = passwordInput ? passwordInput.value : '';

			if (!usernameValue || !passwordValue) {
				if (authStatusMessage) {
					authStatusMessage.textContent = 'Nama pengguna dan kata sandi wajib diisi.';
					authStatusMessage.className = 'status-error status-eror-peringatan';
				}
				return;
			}

			try {
				isSubmitting = true;
				if (submitBtn) {
					submitBtn.disabled = true;
					submitBtn.textContent = 'AUTHENTICATING...'; // FIX SEKURITI: Kaku mengunci tipe textContent murni
				}
				if (authStatusMessage) {
					authStatusMessage.textContent = 'Menghubungi sirkuit kernel...';
					authStatusMessage.className = 'status-success';
				}
				
				// Ekstraksi data ke dalam objek payload mentah
				let payload = {
					username: usernameValue,
					password: passwordValue
				};
				
				// Validasi eksistensi Jembatan Keamanan (Context Bridge Lapis 2 & 3)
				if (!window.SecurityContext || typeof window.SecurityContext.authenticateUser !== 'function') {
					throw new Error('Jembatan SecureContext tidak terdeteksi atau diblokir.');
				}
				
				// Jalankan pengiriman linier menembus kotak pasir: UI -> Preload Bridge -> Main Process / Express API
				const response = await window.SecurityContext.authenticateUser(payload);
				
				if (response && response.success) {
					if (authStatusMessage) {
						authStatusMessage.textContent = 'Otentikasi Berhasil! Memuat sirkuit kernel...';
						authStatusMessage.className = 'status-success';
					}
					
					// FIX BENTENG PERTAHANAN VISUAL: Jika sukses, kunci antarmuka secara kaku 
					if (submitBtn) {
						submitBtn.disabled = true;
						submitBtn.textContent = 'REDIRECTING...';
					}
					if (usernameInput) usernameInput.disabled = true;
					if (passwordInput) passwordInput.disabled = true;

					// STRATEGI VPS: Cek apakah kode ini berjalan di web browser murni luar Electron
					const isElectronEnv = typeof window.process !== 'undefined' && window.process.versions && window.process.versions.electron;
					
					if (!isElectronEnv) {
						// Jika diakses via Web Browser VPS, eksekusi pengalihan URL halaman secara mandiri
						setTimeout(() => {
							window.location.href = '../../main.html'; // Mengarah ke halaman utama dashboard di folder frontend/
						}, 1500);
					}
					return;
				} else {
					// Menampilkan pesan kegagalan resmi hasil komputasi database backend
					if (authStatusMessage) {
						authStatusMessage.textContent = response?.error || 'Nama pengguna atau kata sandi salah.';
						
						// =====================================================================
						// 🔥 TAMBAHAN BARU: SENSOR EVALUASI WARNA TEKS ANTI-BRUTE-FORCE (DENGAN KELAS KAKU)
						// =====================================================================
						const txtError = response?.error || '';
						if (txtError.includes("Blokir") || txtError.includes("Dibekukan") || txtError.includes("dikunci") || txtError.includes("percobaan")) {
							authStatusMessage.className = 'status-error status-eror-kritis';
						} else {
							authStatusMessage.className = 'status-error status-eror-peringatan';
						}
					}
					isSubmitting = false;
					if (submitBtn) {
						submitBtn.disabled = false;
						submitBtn.textContent = 'LOGIN';
					}
				}
			} catch (error) {
				// Tangkap kegagalan pipa komunikasi internal dan catat dengan presisi di konsol lokal developer
				console.error(`[FRONTEND_LOGIN_FATAL] [${timestamp}] Terjadi kerusakan pipa jembatan SecureContext: ${error.message}`);
				if (authStatusMessage) {
					authStatusMessage.textContent = 'Terjadi kesalahan sistem internal pada pipa komunikasi.';
					authStatusMessage.className = 'status-error status-eror-kritis';
				}
				isSubmitting = false;
				if (submitBtn) {
					submitBtn.disabled = false;
					submitBtn.textContent = 'LOGIN';
				}
			} finally {
				// LAPIS CLEANING RAM: Hanya bersihkan memori variabel jika status login GAGAL masuk
				if (!isSubmitting) {
					if (usernameInput) usernameInput.value = '';
					if (passwordInput) passwordInput.value = '';
				}
			}
		});
	}
});
