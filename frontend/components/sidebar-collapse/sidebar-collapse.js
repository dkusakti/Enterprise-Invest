/* ================================================================
   ENTERPRISE SIDEBAR COLLAPSE
   UI-ONLY CONTROLLER
   ================================================================ */

(function initEnterpriseSidebarCollapse() {

    'use strict';


    function init() {

        const app =
            document.getElementById(
                'enterprise-app'
            );

        const sidebar =
            document.getElementById(
                'enterprise-sidebar'
            );

        const button =
            document.getElementById(
                'btn-collapse'
            );


        if (!app || !sidebar || !button) {
            console.warn(
                '[Enterprise Sidebar] Komponen belum lengkap.'
            );
            return;
        }


        const storageKey =
            'enterprise_sidebar_collapsed';


        function updateAria() {

            const collapsed =
                app.classList.contains(
                    'sidebar-collapsed'
                );

            button.setAttribute(
                'aria-expanded',
                String(!collapsed)
            );

        }


        function setCollapsed(
            collapsed,
            save = true
        ) {

            app.classList.toggle(
                'sidebar-collapsed',
                collapsed
            );


            updateAria();


            if (save) {

                try {

                    localStorage.setItem(
                        storageKey,
                        collapsed
                            ? '1'
                            : '0'
                    );

                } catch (error) {

                    console.warn(
                        '[Enterprise Sidebar] Gagal menyimpan state:',
                        error
                    );

                }

            }

        }


        /*
         * Restore state.
         */

        try {

            const saved =
                localStorage.getItem(
                    storageKey
                );

            if (saved === '1') {
                setCollapsed(true, false);
            }

        } catch (error) {

            console.warn(
                '[Enterprise Sidebar] Local storage tidak tersedia:',
                error
            );

        }


        /*
         * Toggle.
         */

        button.addEventListener(
            'click',
            () => {

                const collapsed =
                    !app.classList.contains(
                        'sidebar-collapsed'
                    );

                setCollapsed(collapsed);

            }
        );


        /*
         * ESC pada mobile/overlay state.
         */

        document.addEventListener(
            'keydown',
            (event) => {

                if (
                    event.key !== 'Escape' ||
                    window.innerWidth > 680
                ) {
                    return;
                }

                setCollapsed(true);

            }
        );


        updateAria();

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