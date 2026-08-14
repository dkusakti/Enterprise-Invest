// frontend/pages/sub-settings-token/sub-settings-token.js
(() => {
    const timestamp = new Date().toISOString();
    console.log(`[PAGE_INIT] [${timestamp}] Memuat sirkuit kontroler sub-settings-token...`);

    const inputTokenReset = document.getElementById('input-token-reset');
    const btnTriggerReset = document.getElementById('btn-trigger-reset');
    const msgStatusToken = document.getElementById('msg-status-token');

    if (btnTriggerReset && inputTokenReset) {
        btnTriggerReset.addEventListener('click', async () => {
            const tokenValue = inputTokenReset.value.trim();

            if (!tokenValue) {
                alert('🚨 Validasi Gagal: Frasa konfirmasi wajib diisi untuk memicu aksi destruktif!');
                if (msgStatusToken) {
                    msgStatusToken.textContent = 'Status: Gagal, token kosong.';
                    msgStatusToken.style.color = '#f38ba8';
                }
                return;
            }

            const konfirmasiKedua = confirm('⚠️ PERINGATAN CRITICAL:\nTindakan ini akan menghapus total seluruh data stasiun kerja karyawan di database secara permanen!\n\nApakah Anda yakin ingin melanjutkan?');
            if (!konfirmasiKedua) return;

            try {
                btnTriggerReset.disabled = true;
                btnTriggerReset.textContent = 'DESTROYING...';
                if (msgStatusToken) {
                    msgStatusToken.textContent = 'Status: Mengirim sinyal penghancuran data...';
                    msgStatusToken.style.color = '#f9e2af';
                }

                // Tembak langsung menggunakan interseptor Mandor Backend yang sudah kita amankan sebelumnya!
                // Aksi ini akan melempar frasa ke fungsi 'executeExpressGlobalTruncate' di repository backend
                const respon = await window.DashboardSecurityContext.panggilMandorBackend('TRUNCATE_HARDWARE_DATA', {
                    confirmationPhrase: tokenValue
                });

                if (respon && respon.success) {
                    alert('✅ CRITICAL SUCCESS:\nSeluruh data hardware stasiun kerja berhasil dikosongkan total dari database!');
                    if (msgStatusToken) {
                        msgStatusToken.textContent = 'Status: Penghancuran sukses.';
                        msgStatusToken.style.color = '#a6e3a1';
                    }
                    inputTokenReset.value = '';
                } else {
                    alert(`🚨 CRITICAL FAILURE:\n${respon?.error || 'Gagal mengeksekusi penghancuran data.'}`);
                    if (msgStatusToken) {
                        msgStatusToken.textContent = 'Status: Ditolak oleh server.';
                        msgStatusToken.style.color = '#f38ba8';
                    }
                }
            } catch (err) {
                console.error(`[TOKEN_PAGE_FATAL] [${new Date().toISOString()}] Gangguan pipa komunikasi:`, err.message);
                alert('🚨 Gangguan internal sistem: Pipa komunikasi sirkuit terputus.');
            } finally {
                btnTriggerReset.disabled = false;
                btnTriggerReset.textContent = 'HANCURKAN DATA HARDWARE';
            }
        });
    }
})();
