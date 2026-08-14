// frontend/pages/dashboard/dashboard.js (VERSI DINAMIS TERBARU)

(async function muatLogikaDashboardMultiRole() {
    console.log('[Dashboard Panggung] Mengaktifkan sirkuit pemantauan cerdas berbasis UI Policy Dinamis...');
    
    const tbody = document.getElementById('tabel-live-monitoring');
    const kontainerUtamaDashboard = tbody ? tbody.closest('div') : null;
    
    if (!tbody || !kontainerUtamaDashboard) return;

    // --- 🛡️ SENSOR FILTER BERBASIS JALUR MURNI UI POLICY ---
    async function evaluasiHakAksesDashboard() {
        try {
            // ✅ SINKRONISASI 1: Panggil kebijakan lewat Mandor Backend secara dinamis
            const policyResponse = await window.DashboardSecurityContext.panggilMandorBackend('FETCH_UI_POLICY');
            console.log('[Dashboard Guard] Kebijakan Sesi Diterima:', policyResponse);
            
            if (policyResponse && policyResponse.success) {
                // Gunakan properti role langsung dari respon sukses backend Anda
                const userRole = String(policyResponse.role || 'user').trim().toLowerCase();

                // 🚨 JIKA PENGGUNA ADALAH USER KARYAWAN BIASA
                if (userRole === 'user') {
                    console.log('[Dashboard Guard] Role = user. Menghapus tabel server, memuat widget IoT...');
                    
                    kontainerUtamaDashboard.innerHTML = "";

                    const divIoT = document.createElement('div');
                    divIoT.style.padding = '25px';
                    divIoT.style.background = 'rgba(30, 30, 46, 0.6)';
                    divIoT.style.borderRadius = '8px';
                    divIoT.style.borderLeft = '4px solid #fbc531';
                    divIoT.style.marginTop = '20px';

                    const h3IoT = document.createElement('h3');
                    h3IoT.textContent = '🕹️ Panel Kendali Proyek IoT Karyawan';
                    h3IoT.style.color = '#fbc531';
                    h3IoT.style.margin = '0 0 12px 0';
                    h3IoT.style.fontFamily = 'sans-serif';

                    const pIoT = document.createElement('p');
                    pIoT.textContent = 'Selamat datang di gerbang operasional. Silakan jalankan simulasi pengiriman data mikrokontroler atau pantau aktivitas sensor log pool Anda di bawah ini.';
                    pIoT.style.color = '#a4b0be';
                    pIoT.style.fontSize = '14px';
                    pIoT.style.lineHeight = '1.5';
                    pIoT.style.fontFamily = 'sans-serif';

                    const btnIoT = document.createElement('button');
                    btnIoT.textContent = '🚀 JALANKAN SIMULASI PROYEK IOT';
                    btnIoT.style.background = '#fbc531';
                    btnIoT.style.border = 'none';
                    btnIoT.style.color = '#1e1e2e';
                    btnIoT.style.fontWeight = 'bold';
                    btnIoT.style.padding = '12px 24px';
                    btnIoT.style.borderRadius = '4px';
                    btnIoT.style.cursor = 'pointer';
                    btnIoT.style.marginTop = '15px';
                    btnIoT.style.fontFamily = 'sans-serif';

                    btnIoT.addEventListener('click', () => {
                        alert('Koneksi Sukses! Sinyal data simulasi IoT berhasil ditembakkan ke core data pool.');
                    });

                    divIoT.appendChild(h3IoT);
                    divIoT.appendChild(pIoT);
                    divIoT.appendChild(btnIoT);
                    kontainerUtamaDashboard.appendChild(divIoT);

                    return false; 
                }
            }
            return true; 
        } catch (err) {
            console.error('Gagal memvalidasi kebijakan dashboard:', err.message);
            return false;
        }
    }

    const bolehMuatTabelServer = await evaluasiHakAksesDashboard();
    
    if (bolehMuatTabelServer) {
        
        async function segarkanTabelInfrastruktur() {
            try {
                // ✅ SINKRONISASI 2: Ambil detak jantung & daftar stasiun kerja lewat Mandor Backend
                const respons = await window.DashboardSecurityContext.panggilMandorBackend('CHECK_HEARTBEAT_AND_DEVICES');
                
                if (respons && respons.success && Array.isArray(respons.devices)) {
                    tbody.innerHTML = ""; 

                    if (respons.devices.length === 0) {
                        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #7f8c8d; padding: 40px; font-style: italic;">Data Pool Kosong. Belum ada perangkat keras terikat.</td></tr>`;
                        return;
                    }

                    respons.devices.forEach(device => {
                        const baris = document.createElement('tr');
                        baris.style.borderBottom = '1px solid #2f3640';

                        const tdId = document.createElement('td');
                        tdId.textContent = `#${device.user_id}`;
                        tdId.style.padding = '12px 15px';
                        tdId.style.color = '#7f8c8d';
                        tdId.style.fontFamily = 'monospace';

                        const tdNama = document.createElement('td');
                        tdNama.textContent = device.device_name;
                        tdNama.style.padding = '12px 15px';
                        tdNama.style.fontWeight = 'bold';
                        tdNama.style.color = '#f5f6fa';

                        const tdHash = document.createElement('td');
                        const rawHash = String(device.device_fingerprint || '');
                        const hashPotong = rawHash.length > 15 ? `${rawHash.substring(0, 15)}...` : rawHash;
                        tdHash.textContent = hashPotong;
                        tdHash.style.padding = '12px 15px';
                        tdHash.style.fontFamily = 'monospace';
                        tdHash.style.color = '#00a8ff';

                        const tdStatus = document.createElement('td');
                        tdStatus.style.padding = '12px 15px';
                        tdStatus.style.fontWeight = 'bold';
                        if (device.is_verified) {
                            tdStatus.textContent = '✔ SAH (ACTIVE)';
                            tdStatus.style.color = '#4cd137';
                        } else {
                            tdStatus.textContent = '⏳ PENDING (LOCKED)';
                            tdStatus.style.color = '#e84118';
                        }

                        baris.appendChild(tdId);
                        baris.appendChild(tdNama);
                        baris.appendChild(tdHash);
                        baris.appendChild(tdStatus);
                        tbody.appendChild(baris);
                    });
                }
            } catch (err) {
                console.error("Gagal menyegarkan tabel live monitoring:", err.message);
            }
        }

        // --- AUTOMATION LIFECYCLE CLEANUP ---
        const intervalLive = setInterval(async () => {
            if (!document.getElementById('tabel-live-monitoring')) {
                clearInterval(intervalLive);
                return;
            }
            await segarkanTabelInfrastruktur();
        }, 3000);

        await segarkanTabelInfrastruktur();
    }
})();
