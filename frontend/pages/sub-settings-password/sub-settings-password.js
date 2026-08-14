// frontend/pages/sub-settings-password/sub-settings-password.js
(() => {
    console.log(`[PAGE_INIT] Memuat sirkuit pembaruan kata sandi mandiri...`);
    const btnSubmit = document.getElementById('btn-submit-password');
    const inputLama = document.getElementById('pass-lama');
    const inputBaru = document.getElementById('pass-baru');

    if (btnSubmit && inputLama && inputBaru) {
        btnSubmit.addEventListener('click', async () => {
            const lamaVal = inputLama.value;
            const baruVal = inputBaru.value;

            if (!lamaVal || !baruVal) {
                alert('🚨 Kedua kolom kata sandi wajib diisi!');
                return;
            }
            if (baruVal.length < 6) {
                alert('🚨 Validasi Gagal: Kata sandi baru minimal wajib 6 karakter!');
                return;
            }

            try {
                btnSubmit.disabled = true;
                btnSubmit.textContent = 'UPDATING...';

                const token = localStorage.getItem('vps_access_token');
                const respon = await fetch(`${window.location.origin}/api/user/change-password`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ sandiLama: lamaVal, sandiBaru: baruVal })
                });

                const dataJson = await respon.json();

                if (dataJson && dataJson.success) {
                    alert('✅ Sukses:\nKata sandi akun Anda berhasil diperbarui di database PostgreSQL!');
                    inputLama.value = '';
                    inputBaru.value = '';
                } else {
                    alert(`🚨 Gagal: ${dataJson.error || 'Gagal memproses update password.'}`);
                }
            } catch (e) {
                alert('🚨 Gangguan internal sirkuit jembatan data.');
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.textContent = 'PERBARUI PASSWORD SAYA';
            }
        });
    }
})();
