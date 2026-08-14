// frontend/pages/sub-settings-otp/sub-settings-otp.js
(() => {
    const timestamp = new Date().toISOString();
    console.log(`[PAGE_INIT] [${timestamp}] Memuat sirkuit kontroler panel otorisasi OTP...`);

    const inputOtpDevice = document.getElementById('input-otp-device');
    const btnSubmitOtp = document.getElementById('btn-submit-otp');
    const msgStatusOtp = document.getElementById('msg-status-otp');

    // Menambahkan otomatisasi format strip saat user mengetik 3 angka (opsional/kenyamanan UI)
    if (inputOtpDevice) {
        inputOtpDevice.addEventListener('input', (e) => {
            let nilai = e.target.value.replace(/\D/g, ''); // Buang teks selain angka
            if (nilai.length > 3) {
                e.target.value = `${nilai.slice(0, 3)}-${nilai.slice(3, 6)}`;
            } else {
                e.target.value = nilai;
            }
        });
    }

    if (btnSubmitOtp && inputOtpDevice && msgStatusOtp) {
        btnSubmitOtp.addEventListener('click', async () => {
            const rawOtpValue = inputOtpDevice.value.trim();

            if (!rawOtpValue) {
                alert('🚨 Validasi Gagal: Kode aktivasi wajib diisi!');
                msgStatusOtp.textContent = 'Status: Gagal, kode kosong.';
                msgStatusOtp.style.color = '#f38ba8';
                return;
            }

            try {
                btnSubmitOtp.disabled = true;
                btnSubmitOtp.textContent = 'PROCESSING...';
                msgStatusOtp.textContent = 'Status: Mengirim kode ke sirkuit backend...';
                msgStatusOtp.style.color = '#f9e2af';

                // =====================================================================
                // 🔒 TAMPILAN EVALUASI 1: VALIDASI FORMAT TERDEPAN (DTO CONTROLLER SINKRON)
                // =====================================================================
                // Memanggil antiBruteForceController.evaluateAttempt via Mandor Backend
                // Mengirimkan objek { code: ... } sepadan dengan struktur DTO
                const evaluasiAwal = await window.DashboardSecurityContext.panggilMandorBackend('APPROVE_DEVICE', {
                    code: rawOtpValue
                });

                // Memanfaatkan struktur respon asli dari fungsi loginRepository.approveDevice Anda
                if (evaluasiAwal && evaluasiAwal.success) {
                    alert('✅ OTORISASI SUKSES:\nStasiun kerja baru berhasil disetujui! Pengguna sekarang sudah bisa masuk ke dashboard.');
                    msgStatusOtp.textContent = 'Status: Perangkat diizinkan masuk.';
                    msgStatusOtp.style.color = '#a6e3a1';
                    inputOtpDevice.value = '';
                } else {
                    // Menangkap status kegagalan, termasuk pembekuan state brute force "AKSES DIBEKUKAN"
                    const teksEror = evaluasiAwal?.error || 'Kode aktivasi salah atau tidak terdaftar.';
                    alert(`🚨 OTORISASI DITOLAK:\n${teksEror}`);
                    
                    msgStatusOtp.textContent = `Status: ${teksEror}`;
                    if (teksEror.includes('DIBEKUKAN') || teksEror.includes('dikunci')) {
                        msgStatusOtp.style.color = '#f38ba8';
                    } else {
                        msgStatusOtp.style.color = '#f9e2af';
                    }
                }

            } catch (err) {
                console.error(`[OTP_PAGE_FATAL] [${new Date().toISOString()}] Gangguan pipa jembatan IPC/Express:`, err.message);
                alert('🚨 Gangguan internal sistem: Gagal melakukan jabat tangan data.');
                msgStatusOtp.textContent = 'Status: Koneksi terputus.';
                msgStatusOtp.style.color = '#f38ba8';
            } finally {
                btnSubmitOtp.disabled = false;
                btnSubmitOtp.textContent = 'SETUJUI PERANGKAT BARU';
            }
        });
    }
})();
