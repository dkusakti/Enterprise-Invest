/* ================================================================
   ENTERPRISE HEADER
   UI-ONLY CONTROLLER
   ================================================================ */

(function initEnterpriseHeader() {

    'use strict';


    function init() {

        const notificationButton =
            document.getElementById(
                'header-notification'
            );

        const notificationCount =
            document.getElementById(
                'header-notification-count'
            );

        const headerUser =
            document.getElementById(
                'user-profile-tag'
            );


        /*
         * Notification button.
         *
         * Sengaja tidak memanggil API/database.
         * Data notification tetap menjadi tanggung jawab
         * modul masing-masing.
         */

        if (notificationButton) {

            notificationButton.addEventListener(
                'click',
                () => {

                    notificationButton.classList.toggle(
                        'is-active'
                    );

                }
            );

        }


        /*
         * Aksesibilitas profile.
         */

        if (headerUser) {

            headerUser.addEventListener(
                'keydown',
                (event) => {

                    if (event.key === 'Enter') {

                        event.preventDefault();

                        const avatar =
                            document.getElementById(
                                'foto-profil-header'
                            );

                        if (avatar) {
                            avatar.click();
                        }

                    }

                }
            );

        }


        /*
         * Jika jumlah notifikasi kosong/invalid,
         * tetap tampil sebagai 0.
         */

        if (notificationCount) {

            const value =
                Number(
                    notificationCount.textContent
                );

            if (!Number.isFinite(value) || value < 0) {
                notificationCount.textContent = '0';
            }

        }

    }


    if (document.readyState === 'loading') {

        document.addEventListener(
            'DOMContentLoaded',
            init,
            { once: true }
        );

    } else {

        init();

    }

})();