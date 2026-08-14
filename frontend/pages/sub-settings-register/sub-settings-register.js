// frontend/pages/sub-settings-register/sub-settings-register.js
(() => {
    console.log(`[PAGE_INIT] Memuat sikit registrasi akun otomatis...`);
    const btnSubmit = document.getElementById('btn-submit-register');
    const selectRole = document.getElementById('select-register-role');
    const inputPass = document.getElementById('input-register-pass');
    
    const boxHasil = document.getElementById('box-hasil-cetak');
    const resUser = document.getElementById('res-username');
    const resPass = document.getElementById('res-password');
    const resRole = document.getElementById('res-role');

    if (btnSubmit && selectRole && inputPass) {
        btnSubmit.addEventListener('click', async () => {
            const roleVal = selectRole.value;
            const passVal = inputPass.value.trim();

            if (!passVal) {
                alert('🚨 Kata sandi default tidak boleh kosong!');
                return;
            }

            try {
                btnSubmit.disabled = true;
                btnSubmit.textContent = 'GENERATING...';

                // Tembak REST API Endpoint via Jembatan Context Bridge yang kompatibel di local/vps
                const token = localStorage.getItem('vps_access_token');
                const respon = await fetch(`${window.location.origin}/api/owner/register-user`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ role: roleVal, passwordDefault: passVal })
                });

                const dataJson = await respon.json();

                if (dataJson && dataJson.success) {
                    alert('✅ Sukses: Akun karyawan baru berhasil dicetak!');
                    if (boxHasil && resUser && resPass && resRole) {
                        resUser.textContent = dataJson.username;
                        resPass.textContent = dataJson.password;
                        resRole.textContent = dataJson.role.toUpperCase();
                        boxHasil.style.display = 'block';
                    }
                } else {
                    alert(`🚨 Gagal: ${dataJson.error || 'Otoritas ditolak server.'}`);
                }
            } catch (e) {
                alert('🚨 Gangguan komunikasi internal sirkuit jembatan data.');
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.textContent = 'GENERASI AKUN BARU';
            }
        });
    }
})();
