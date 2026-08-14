// frontend/pages/activity-log/activity-log.js
(() => {
    const timestamp = new Date().toISOString();
    console.log(`[PAGE_INIT] [${timestamp}] Memuat sirkuit tabel audit log aktivitas...`);

    const tabelBodyLog = document.getElementById('tabel-body-log');

    async function muatDataLogAktivitas() {
        if (!tabelBodyLog) return;

        try {
            // Tarik data riwayat audit log secara dinamis menggunakan gerbang Mandor Frontend
            const responLog = await window.DashboardSecurityContext.panggilMandorFrontend({
                aksi: 'ambil_data',
                target_tabel: 'activity_log'
            });

            if (responLog && responLog.status === 'OK' && Array.isArray(responLog.data)) {
                tabelBodyLog.innerHTML = ""; // Bersihkan status memuat

                if (responLog.data.length === 0) {
                    tabelBodyLog.innerHTML = `<tr><td colspan="5" style="padding: 20px; text-align: center; color: #64748b;">Tidak ada jejak aktivitas tercatat.</td></tr>`;
                    return;
                }

                responLog.data.forEach((log) => {
                    const row = document.createElement('tr');
                    row.style.borderBottom = '1px solid #313244';
                    row.style.transition = 'background 0.2s';
                    row.onmouseover = () => row.style.background = '#1e1e2e';
                    row.onmouseout = () => row.style.background = 'transparent';

                    // FIX SEKURITI: Cegah DOM Injection / XSS dari teks log dengan memisahkan kolom menggunakan textContent kaku
                    const tdWaktu = document.createElement('td');
                    tdWaktu.style.padding = '12px 15px';
                    tdWaktu.style.fontFamily = 'monospace';
                    
                    // SINKRONISASI ZONA WAKTU: Mengubah string ISO UTC database secara otomatis menjadi jam lokal Indonesia (WIB)
                    if (log.created_at) {
                        const objekWaktuLokal = new Date(log.created_at);
                        tdWaktu.textContent = objekWaktuLokal.toLocaleString('id-ID', { 
                            timeZone: 'Asia/Jakarta', 
                            hour12: false 
                        });
                    } else {
                        tdWaktu.textContent = '-';
                    }

                    const tdUser = document.createElement('td');
                    tdUser.style.padding = '12px 15px';
                    tdUser.textContent = String(log.username || 'System');

                    const tdAksi = document.createElement('td');
                    tdAksi.style.padding = '12px 15px';
                    tdAksi.style.fontWeight = 'bold';
                    tdAksi.style.color = '#f9e2af';
                    tdAksi.textContent = String(log.action_name || log.aksi || '-');

                    const tdTabel = document.createElement('td');
                    tdTabel.style.padding = '12px 15px';
                    tdTabel.style.fontFamily = 'monospace';
                    tdTabel.textContent = String(log.target_table || log.target_tabel || '-');

                    const tdStatus = document.createElement('td');
                    tdStatus.style.padding = '12px 15px';
                    const isSuccessLog = String(log.status || '').toUpperCase() === 'OK' || String(log.status || '').toUpperCase() === 'SUCCESS';
                    tdStatus.style.color = isSuccessLog ? '#a6e3a1' : '#f38ba8';
                    tdStatus.textContent = String(log.status || 'UNKNOWN');

                    row.appendChild(tdWaktu);
                    row.appendChild(tdUser);
                    row.appendChild(tdAksi);
                    row.appendChild(tdTabel);
                    row.appendChild(tdStatus);

                    tabelBodyLog.appendChild(row);
                });
            } else {
                tabelBodyLog.innerHTML = `<tr><td colspan="5" style="padding: 20px; text-align: center; color: #f38ba8;">⚠️ Gagal melakukan sinkronisasi data log audit dari server.</td></tr>`;
            }

        } catch (err) {
            console.error(`[ACTIVITY_LOG_PAGE_FATAL] [${new Date().toISOString()}] Gagal memproses muat tabel log:`, err.message);
            tabelBodyLog.innerHTML = `<tr><td colspan="5" style="padding: 20px; text-align: center; color: #f38ba8;">🚨 Gangguan internal sirkuit pipa komunikasi data log.</td></tr>`;
        }
    }

    // Jalankan pemuatan otomatis data log audit saat halaman dipasang ke panggung utama
    muatDataLogAktivitas();
})();
