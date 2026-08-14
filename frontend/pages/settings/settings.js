// frontend/pages/settings/settings.js
import AccessPolicy from '../../access-policy.js'; // ✅ PASTIKAN IMPOR AKTIF

(async function engineNavigasiModularSettings() {
    // 1. Ambil kebijakan sesi aktif murni dari backend RAM (Tahu role user aktif)
    const policyResponse = await window.DashboardSecurityContext.getUIPolicy();
    const userRole = String(policyResponse?.role || 'user').trim().toLowerCase();

    // =====================================================================
    // 🛡️ SINKRONISASI COUPLING: BERSIHKAN SUB-MENU TEPAT SAAT HALAMAN DIBUKA
    // =====================================================================
    // Sekarang, fungsi dipicu saat elemen HTML Settings sudah nyata eksis di layar!
    AccessPolicy.cleanSettingsSubMenu(userRole);
    // =====================================================================

    // Tangkap kembali elemen DOM yang lolos dari sensor penyaringan di atas
    const btnPerangkat = document.getElementById('btn-sub-perangkat');
    const btnKeamanan = document.getElementById('btn-sub-keamanan');
    const btnTema = document.getElementById('btn-sub-tema'); // Opsional jika ada tombol tema di html

    // --- FUNGSI UNIVERSAL UNTUK MEMUAT POTONGAN SUB-MENU ---
    async function muatKomponenSubMenu(namaFileHtml, namaFileJs) {
        const kontainerKanan = document.getElementById('konten-pengaturan-dinamis');
        if (!kontainerKanan) return;

        try {
            const responHtml = await fetch(namaFileHtml);
            kontainerKanan.innerHTML = await responHtml.text();

            const skripLama = document.getElementById('skrip-sub-menu-aktif');
            if (skripLama) skripLama.remove();

            const skripBaru = document.createElement('script');
            skripBaru.src = namaFileJs;
            skripBaru.id = 'skrip-sub-menu-aktif';
            document.body.appendChild(skripBaru);
        } catch (err) {
            kontainerKanan.innerHTML = `<div style="color: #f38ba8; padding: 20px;">❌ Gagal memuat komponen sub-menu: ${err.message}</div>`;
        }
    }

    // --- REGISTER EVENT KLIK NAVIGASI INTERNAL (Hanya jalan jika elemen lolos sensor) ---
    if (btnPerangkat && document.body.contains(btnPerangkat)) {
        btnPerangkat.addEventListener('click', async () => {
            btnPerangkat.className = 'menu-item-settings sub-aktif';
            if (btnKeamanan) btnKeamanan.className = 'menu-item-settings';
            if (btnTema) btnTema.className = 'menu-item-settings';
            await muatKomponenSubMenu('pages/settings/manajemen-perangkat.html', 'pages/settings/manajemen-perangkat.js');
        });
    }

    if (btnKeamanan && document.body.contains(btnKeamanan)) {
        btnKeamanan.addEventListener('click', async () => {
            btnKeamanan.className = 'menu-item-settings sub-aktif';
            if (btnPerangkat) btnPerangkat.className = 'menu-item-settings';
            if (btnTema) btnTema.className = 'menu-item-settings';
            await muatKomponenSubMenu('pages/settings/keamanan-pengguna.html', 'pages/settings/keamanan-pengguna.js');
        });
    }

    // =====================================================================
    // 🧠 CERDAS DEFAULT BOOTING SUB-MENU: Buka halaman pertama yang lolos sensor
    // =====================================================================
    if (AccessPolicy.isSubMenuAllowed(userRole, 'manajemen-perangkat')) {
        await muatKomponenSubMenu('pages/settings/manajemen-perangkat.html', 'pages/settings/manajemen-perangkat.js');
    } else if (AccessPolicy.isSubMenuAllowed(userRole, 'profil-iot')) {
        // Jika ke depan user (karyawan IoT) membuka settings, layar kanan langsung memuat halaman profil mereka
        await muatKomponenSubMenu('pages/settings/profil-iot.html', 'pages/settings/profil-iot.js');
    } else {
        // Fallback default jika semua kosong
        const kontainerKanan = document.getElementById('konten-pengaturan-dinamis');
        if (kontainerKanan) kontainerKanan.innerHTML = `<div style="color: #7f8c8d; padding: 20px; font-style: italic;">Silakan pilih sub-menu pengaturan operasional Anda.</div>`;
    }
})();
