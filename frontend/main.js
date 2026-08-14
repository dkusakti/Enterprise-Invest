/* ================================================================
   ENTERPRISE INVEST SYSTEM
   MAIN APPLICATION CONTROLLER
   ================================================================ */

document.addEventListener(
    'DOMContentLoaded',
    async () => {

        'use strict';


        /* =========================================================
           COMPONENT LOADER
           ========================================================= */

        async function muatKomponen(
            rootId,
            htmlPath,
            jsPath
        ) {

            const root =
                document.getElementById(rootId);

            if (!root) {
                throw new Error(
                    `Container '${rootId}' tidak ditemukan.`
                );
            }


            const respon =
                await fetch(
                    `${htmlPath}?v=${Date.now()}`,
                    {
                        cache: 'no-store'
                    }
                );


            if (!respon.ok) {
                throw new Error(
                    `Komponen '${htmlPath}' gagal dimuat (${respon.status}).`
                );
            }


            root.innerHTML =
                await respon.text();


            if (jsPath) {

                const script =
                    document.createElement(
                        'script'
                    );

                script.src =
                    `${jsPath}?v=${Date.now()}`;

                script.async = false;

                document.body.appendChild(
                    script
                );

            }

        }


        /*
         * Muat shell UI terlebih dahulu.
         *
         * Tidak menyentuh database.
         * Tidak menyentuh jalur menu.
         */

        try {

            await Promise.all([

                muatKomponen(
                    'sidebar-root',
                    './components/sidebar-collapse/sidebar-collapse.html',
                    './components/sidebar-collapse/sidebar-collapse.js'
                ),

                muatKomponen(
                    'header-root',
                    './components/header/header.html',
                    './components/header/header.js'
                )

            ]);

        } catch (componentError) {

            console.error(
                '[ENTERPRISE COMPONENT ERROR]',
                componentError
            );


            const panggung =
                document.getElementById(
                    'panggung-konten'
                );


            if (panggung) {

                panggung.innerHTML = `
                    <section
                        style="
                            max-width:680px;
                            margin:80px auto;
                            padding:28px;
                            border:1px solid rgba(255,111,145,.22);
                            border-radius:18px;
                            background:rgba(255,111,145,.035);
                            color:#ff6f91;
                            font-family:inherit;
                        "
                    >
                        <strong
                            style="
                                display:block;
                                margin-bottom:8px;
                                font-size:16px;
                            "
                        >
                            Enterprise gagal memuat antarmuka
                        </strong>

                        <span
                            style="
                                color:#849390;
                                font-size:13px;
                            "
                        >
                            Komponen utama tidak dapat dimuat.
                            Periksa struktur folder components.
                        </span>
                    </section>
                `;

            }

            return;
        }


        /* =========================================================
           ELEMENT REFERENCES
           ========================================================= */

        const panggung =
            document.getElementById(
                'panggung-konten'
            );

        const btnLogout =
            document.getElementById(
                'btn-logout'
            );


        /* =========================================================
           SPA PAGE LOADER
           ========================================================= */

        async function gantiPanggung(
            namaPage
        ) {

            const timestamp =
                new Date().toISOString();


            try {

                /*
                 * Tetap mempertahankan validasi nama halaman
                 * dari sistem sebelumnya.
                 */

                const safePageName =
                    String(
                        namaPage || ''
                    )
                        .trim()
                        .replace(
                            /[^a-zA-Z0-9_-]/g,
                            ''
                        );


                if (!safePageName) {
                    throw new Error(
                        'Identitas nama halaman kosong atau malformed.'
                    );
                }


                const pathFile =
                    `./pages/${safePageName}/${safePageName}.html`;


                const respon =
                    await fetch(
                        pathFile,
                        {
                            cache: 'no-store'
                        }
                    );


                if (!respon.ok) {

                    throw new Error(
                        `Halaman '${safePageName}.html' tidak ditemukan.`
                    );

                }


                if (!panggung) {
                    throw new Error(
                        'Container panggung-konten tidak ditemukan.'
                    );
                }


                panggung.innerHTML =
                    await respon.text();


                /*
                 * Bersihkan script halaman sebelumnya.
                 */

                const scriptLama =
                    document.querySelector(
                        '[id^="script-panggung-"]'
                    );


                if (scriptLama) {
                    scriptLama.remove();
                }


                /*
                 * Muat JS halaman secara dinamis.
                 */

                const scriptBaru =
                    document.createElement(
                        'script'
                    );


                scriptBaru.id =
                    `script-panggung-${safePageName}`;


                scriptBaru.src =
                    `./pages/${safePageName}/${safePageName}.js?v=${Date.now()}`;


                document.body.appendChild(
                    scriptBaru
                );


                /*
                 * Kembalikan focus ke stage agar keyboard
                 * navigation tetap masuk akal.
                 */

                if (
                    panggung &&
                    typeof panggung.focus === 'function'
                ) {

                    panggung.focus({
                        preventScroll: true
                    });

                }

            } catch (err) {

                console.error(
                    `[SPA_ROUTER_ERROR] [${timestamp}] Gagal melakukan transisi pemuatan panggung halaman: ${err.message}`
                );


                if (panggung) {

                    panggung.innerHTML = `
                        <section
                            style="
                                max-width:650px;
                                margin:80px auto;
                                padding:28px;
                                border:1px solid rgba(255,111,145,.25);
                                border-radius:18px;
                                background:
                                    linear-gradient(
                                        145deg,
                                        rgba(255,111,145,.055),
                                        rgba(255,255,255,.012)
                                    );
                                box-shadow:
                                    0 20px 60px rgba(0,0,0,.18);
                            "
                        >

                            <div
                                style="
                                    display:flex;
                                    gap:15px;
                                    align-items:flex-start;
                                "
                            >

                                <div
                                    style="
                                        width:38px;
                                        height:38px;
                                        display:grid;
                                        place-items:center;
                                        border-radius:11px;
                                        border:1px solid rgba(255,111,145,.25);
                                        color:#ff6f91;
                                        flex:0 0 38px;
                                    "
                                >
                                    !
                                </div>

                                <div>

                                    <strong
                                        style="
                                            display:block;
                                            margin-bottom:7px;
                                            color:#ff7d9d;
                                            font-size:16px;
                                        "
                                    >
                                        Workspace tidak dapat dimuat
                                    </strong>

                                    <span
                                        style="
                                            color:#81908d;
                                            font-size:13px;
                                            line-height:1.6;
                                        "
                                    >
                                        Halaman role tidak tersedia
                                        atau terjadi gangguan saat
                                        memuat resource.
                                    </span>

                                </div>

                            </div>

                        </section>
                    `;

                }

            }

        }


        /* =========================================================
           MENU DATABASE
           
           BAGIAN INI MEMPERTAHANKAN JALUR DATA REPO.
           
           app_menus
           panggilMandorFrontend
           FETCH_UI_POLICY
           
           TIDAK DIUBAH.
           ========================================================= */

        async function konstruksiMenuOtomatis() {

            const timestamp =
                new Date().toISOString();


            const wadahMenu =
                document.getElementById(
                    'wadah-menu-dinamis'
                );


            if (!wadahMenu) {

                console.error(
                    '[MENU] #wadah-menu-dinamis tidak ditemukan.'
                );

                return;

            }


            try {

                /*
                 * ==================================================
                 * DATABASE MENU
                 * ==================================================
                 */

                const responMenu =
                    await window
                        .DashboardSecurityContext
                        .panggilMandorFrontend({

                            aksi: 'ambil_data',

                            target_tabel: 'app_menus'

                        });


                if (
                    responMenu &&
                    responMenu.status === 'OK' &&
                    Array.isArray(responMenu.data)
                ) {

                    wadahMenu.innerHTML = "";


                    /*
                     * ==================================================
                     * USER POLICY
                     * ==================================================
                     */

                    const txtProfil =
                        document.getElementById(
                            'user-profile-tag-role'
                        );


                    const txtNamaHdr =
                        document.getElementById(
                            'nama-user-header'
                        );


                    const imgFpHeader =
                        document.getElementById(
                            'foto-profil-header'
                        );


                    if (txtProfil) {

                        const policyRespon =
                            await window
                                .DashboardSecurityContext
                                .panggilMandorBackend(
                                    'FETCH_UI_POLICY'
                                );


                        if (
                            policyRespon &&
                            (
                                policyRespon.status === 'success' ||
                                policyRespon.status === 'OK'
                            )
                        ) {

                            const peranAsli =
                                String(
                                    policyRespon.policy ||
                                    policyRespon.role ||
                                    'user'
                                )
                                    .trim()
                                    .toLowerCase();


                            const namaAsli =
                                String(
                                    policyRespon.username ||
                                    'Admin Node'
                                )
                                    .trim();


                            const userIdAktif =
                                policyRespon.userId || 0;


                            /*
                             * Tetap menggunakan textContent.
                             * Tidak menggunakan innerHTML untuk
                             * data user.
                             */

                            if (txtNamaHdr) {

                                txtNamaHdr.textContent =
                                    namaAsli;

                            }


                            if (txtProfil) {

                                txtProfil.textContent =
                                    peranAsli === 'user'
                                        ? 'Enterprise User'
                                        : peranAsli.toUpperCase();

                            }


                            let warnaNeonKasta =
                                '#a6e3a1';


                            if (
                                peranAsli === 'owner'
                            ) {

                                warnaNeonKasta =
                                    '#f38ba8';

                            } else if (
                                peranAsli === 'adminmaster'
                            ) {

                                warnaNeonKasta =
                                    '#f9e2af';

                            }


                            if (txtProfil) {

                                txtProfil.style.color =
                                    warnaNeonKasta;

                            }


                            if (imgFpHeader) {

                                imgFpHeader.style.borderColor =
                                    warnaNeonKasta;

                            }


                            /*
                             * Tetap mempertahankan mekanisme
                             * avatar localStorage.
                             */

                            const fotoLokalLama =
                                localStorage.getItem(
                                    `avatar_local_${namaAsli}`
                                );


                            if (
                                fotoLokalLama &&
                                imgFpHeader
                            ) {

                                imgFpHeader.src =
                                    fotoLokalLama;

                            }

                        }

                    }


                    /* ==================================================
                       MENU ACCORDION
                       ================================================== */

                    let wadahSubMenuAktif = null;


                    responMenu.data.forEach(
                        (menu) => {

                            const angkaUrut =
                                parseFloat(
                                    menu.sort_order
                                );


                            /*
                             * MENU UTAMA
                             */

                            if (
                                menu.jenis === 'utama'
                            ) {

                                const btnUtama =
                                    document.createElement(
                                        'button'
                                    );


                                btnUtama.className =
                                    'nav-item';


                                btnUtama.type =
                                    'button';


                                btnUtama.setAttribute(
                                    'data-page',
                                    menu.folder_name
                                );


                                const imgIcon =
                                    document.createElement(
                                        'img'
                                    );


                                imgIcon.className =
                                    'icon-menu-img';


                                imgIcon.src =
                                    `./assets/logo-menu/${menu.icon_visual}`;


                                imgIcon.alt = "";


                                imgIcon.loading =
                                    'lazy';


                                const spanText =
                                    document.createElement(
                                        'span'
                                    );


                                spanText.textContent =
                                    String(
                                        menu.menu_name
                                    );


                                btnUtama.appendChild(
                                    imgIcon
                                );


                                btnUtama.appendChild(
                                    spanText
                                );


                                const panelGrupSub =
                                    document.createElement(
                                        'div'
                                    );


                                panelGrupSub.className =
                                    'grup-sub-accordion';


                                panelGrupSub.id =
                                    `sub-grup-id-${Math.floor(angkaUrut)}`;


                                btnUtama.addEventListener(
                                    'click',
                                    () => {

                                        const semuaGrupSub =
                                            wadahMenu.querySelectorAll(
                                                '.grup-sub-accordion'
                                            );


                                        semuaGrupSub.forEach(
                                            (grup) => {

                                                if (
                                                    grup !==
                                                    panelGrupSub
                                                ) {

                                                    grup.classList.remove(
                                                        'buka-mekar'
                                                    );

                                                }

                                            }
                                        );


                                        panelGrupSub.classList.toggle(
                                            'buka-mekar'
                                        );


                                        const semuaNav =
                                            wadahMenu.querySelectorAll(
                                                '.nav-item'
                                            );


                                        semuaNav.forEach(
                                            (nav) => {

                                                nav.classList.remove(
                                                    'active'
                                                );

                                            }
                                        );


                                        btnUtama.classList.add(
                                            'active'
                                        );


                                        gantiPanggung(
                                            menu.folder_name
                                        );

                                    }
                                );


                                wadahMenu.appendChild(
                                    btnUtama
                                );


                                wadahMenu.appendChild(
                                    panelGrupSub
                                );


                                wadahSubMenuAktif =
                                    panelGrupSub;

                            }


                            /*
                             * SUB MENU
                             */

                            else if (
                                menu.jenis === 'sub' &&
                                wadahSubMenuAktif
                            ) {

                                const btnSub =
                                    document.createElement(
                                        'button'
                                    );


                                btnSub.className =
                                    'nav-item nav-sub-item';


                                btnSub.type =
                                    'button';


                                btnSub.setAttribute(
                                    'data-page',
                                    menu.folder_name
                                );


                                const imgSubIcon =
                                    document.createElement(
                                        'img'
                                    );


                                imgSubIcon.className =
                                    'icon-menu-img';


                                imgSubIcon.src =
                                    `./assets/logo-menu/${menu.icon_visual}`;


                                imgSubIcon.alt = "";


                                imgSubIcon.loading =
                                    'lazy';


                                const spanSubText =
                                    document.createElement(
                                        'span'
                                    );


                                spanSubText.textContent =
                                    String(
                                        menu.menu_name
                                    );


                                btnSub.appendChild(
                                    imgSubIcon
                                );


                                btnSub.appendChild(
                                    spanSubText
                                );


                                btnSub.addEventListener(
                                    'click',
                                    (e) => {

                                        e.stopPropagation();


                                        const semuaTombol =
                                            wadahMenu.querySelectorAll(
                                                '.nav-item'
                                            );


                                        semuaTombol.forEach(
                                            (btn) => {

                                                btn.classList.remove(
                                                    'active'
                                                );

                                            }
                                        );


                                        btnSub.classList.add(
                                            'active'
                                        );


                                        gantiPanggung(
                                            menu.folder_name
                                        );

                                    }
                                );


                                wadahSubMenuAktif.appendChild(
                                    btnSub
                                );

                            }

                        }
                    );


                    /*
                     * Buka halaman pertama dari data database.
                     */

                    if (
                        responMenu.data.length > 0
                    ) {

                        gantiPanggung(
                            responMenu
                                .data[0]
                                .folder_name
                        );

                    }

                } else {

                    wadahMenu.innerHTML = `
                        <div
                            style="
                                padding:14px;
                                color:#ff7d9d;
                                font-size:11px;
                                border:1px solid rgba(255,111,145,.12);
                                border-radius:10px;
                                background:rgba(255,111,145,.025);
                            "
                        >
                            Gagal sinkronisasi menu.
                        </div>
                    `;

                }

            } catch (error) {

                console.error(
                    `[MENU_ERROR] [${timestamp}] Gagal merangkai sidebar:`,
                    error
                );


                wadahMenu.innerHTML = `
                    <div
                        style="
                            padding:14px;
                            color:#ff7d9d;
                            font-size:11px;
                        "
                    >
                        Menu tidak dapat dimuat.
                    </div>
                `;

            }

        }


        /* =========================================================
           LOGOUT
           ========================================================= */

        if (btnLogout) {

            btnLogout.addEventListener(
                'click',
                async () => {

                    try {

                        await window
                            .DashboardSecurityContext
                            .logoutManual();

                    } catch (logoutError) {

                        console.error(
                            'Gagal mengeksekusi perintah logout resmi:',
                            logoutError.message
                        );

                    }

                }
            );

        }


        /* =========================================================
           AVATAR
           
           Mekanisme localStorage tetap dipertahankan.
           ========================================================= */

        const imgFpHeaderClick =
            document.getElementById(
                'foto-profil-header'
            );


        const inputFileAvatar =
            document.getElementById(
                'input-file-avatar'
            );


        if (
            imgFpHeaderClick &&
            inputFileAvatar
        ) {

            imgFpHeaderClick.addEventListener(
                'click',
                () => {

                    inputFileAvatar.click();

                }
            );


            inputFileAvatar.addEventListener(
                'change',
                async (event) => {

                    const files =
                        event.target.files;


                    if (
                        !files ||
                        files.length === 0
                    ) {
                        return;
                    }


                    const fileTerpilih =
                        files[0];


                    const ekstensiFile =
                        fileTerpilih.name
                            .split('.')
                            .pop()
                            .toLowerCase();


                    const daftarEkstensiSah =
                        [
                            'png',
                            'jpg',
                            'jpeg'
                        ];


                    if (
                        !daftarEkstensiSah.includes(
                            ekstensiFile
                        )
                    ) {

                        alert(
                            'Validasi gagal: hanya PNG, JPG, atau JPEG yang diperbolehkan.'
                        );


                        inputFileAvatar.value =
                            '';


                        return;

                    }


                    if (
                        fileTerpilih.size >
                        2 * 1024 * 1024
                    ) {

                        alert(
                            'Ukuran foto maksimal adalah 2MB.'
                        );


                        inputFileAvatar.value =
                            '';


                        return;

                    }


                    const pembacaFile =
                        new FileReader();


                    pembacaFile.onload =
                        async (e) => {

                            const stringBase64Foto =
                                e.target.result;


                            try {

                                const policyCheck =
                                    await window
                                        .DashboardSecurityContext
                                        .panggilMandorBackend(
                                            'FETCH_UI_POLICY'
                                        );


                                const usernameAktif =
                                    String(
                                        policyCheck?.username ||
                                        'default_user'
                                    ).trim();


                                if (
                                    usernameAktif ===
                                    'default_user'
                                ) {

                                    throw new Error(
                                        'Identitas Sesi tidak valid.'
                                    );

                                }


                                localStorage.setItem(
                                    `avatar_local_${usernameAktif}`,
                                    stringBase64Foto
                                );


                                imgFpHeaderClick.src =
                                    stringBase64Foto;


                            } catch (err) {

                                console.error(
                                    '[AVATAR LOCAL STORAGE ERROR]:',
                                    err.message
                                );


                                alert(
                                    'Gangguan internal saat memproses foto profil.'
                                );

                            }

                        };


                    pembacaFile.readAsDataURL(
                        fileTerpilih
                    );

                }
            );

        }

        /* =========================================================
           START
           ========================================================= */

        await konstruksiMenuOtomatis();

    }
);