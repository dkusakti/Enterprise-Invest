// backend/infrastructure/ipc/mandor-frontend.js (PART 1)
import db from '../../database/pool.js'; 

const CACHE_STRUKTUR_RAM = {};

const MandorFrontend = {
    /**
     * FUNGSI INTERNAL: Mencatat riwayat operasi siber secara otomatis ke database (Audit Trail)
     * Menjamin pelacakan aktivitas mandor dan karyawan tersimpan linear tanpa merusak tabel login.
     */
    catatLogAktivitas: async (userId, username, aksi, targetTabel, status) => {
        try {
            const queryLog = `
                INSERT INTO activity_log (user_id, username, action_name, target_table, status) 
                VALUES ($1, $2, $3, $4, $5);
            `;
            await db.query(queryLog, [
                userId ? parseInt(userId, 10) : null,
                String(username || 'System'),
                String(aksi),
                String(targetTabel),
                String(status)
            ]);
        } catch (logError) {
            console.error(`[MANDOR_LOG_FAILURE] [${new Date().toISOString()}] Gagal menulis log audit: ${logError.message}`);
        }
    },

    /**
     * Inti dari mesin otomatisasi CRUD dinamis sepadan dengan kasta peran pengguna.
     */
    eksekusiMenuSpesifik: async (suratPerintah, currentSessionRole, contextUser = {}) => {
        const timestamp = new Date().toISOString();
        const { aksi, target_tabel } = suratPerintah;

        // Ekstrak identitas asli pengguna dari penampung konteks untuk kebutuhan pencatatan log
        const logUserId = contextUser.id || null;
        const logUsername = contextUser.username || 'unknown_user';

        if (!target_tabel || !aksi) {
            return { status: 'ERROR', pesan: 'Surat perintah tidak lengkap! target_tabel wajib diisi.' };
        }
        
        const namaTabelSakti = target_tabel.trim().toLowerCase();
        if (!/^[a-zA-Z0-9_]+$/.test(namaTabelSakti)) {
            console.warn(`[MANDOR_FRONTEND_WARN] [${timestamp}] Percobaan manipulasi nama tabel diblokir: "${namaTabelSakti}"`);
            return { status: 'ERROR', pesan: 'Akses Ditolak: Nama tabel mengandung karakter ilegal terlarang!' };
        }
        
        const roleSesiAktif = String(currentSessionRole || 'user').trim().toLowerCase().replace(/\s+/g, '');
        
        try {
            const menuRuleQuery = `SELECT roles_allowed FROM app_menus WHERE folder_name = $1 LIMIT 1;`;
            const menuRuleResult = await db.query(menuRuleQuery, [namaTabelSakti]);

            if (menuRuleResult.rows.length > 0) {
                const rawRolesAllowed = String(menuRuleResult.rows[0].roles_allowed || '').toLowerCase();
                const arrayRolesAllowed = rawRolesAllowed.split(',').map(r => r.trim());
                
                const cleanRoleSesi = roleSesiAktif;
                let isAllowed = arrayRolesAllowed.includes('all') || arrayRolesAllowed.includes(cleanRoleSesi);
                
                if (cleanRoleSesi === 'admin' || cleanRoleSesi === 'adminmaster') {
                    if (arrayRolesAllowed.includes('admin') || arrayRolesAllowed.includes('adminmaster')) {
                        isAllowed = true;
                    }
                }
                if (!isAllowed) {
                    console.warn(`[🚨 BLOKIR SYSTEM] [${timestamp}] Peran "${roleSesiAktif}" dilarang keras memuat tabel "${namaTabelSakti}".`);
                    // Rekam jejak percobaan pembajakan ilegal pengguna ke tabel activity_log
                    await MandorFrontend.catatLogAktivitas(logUserId, logUsername, aksi, namaTabelSakti, 'BLOCKED');
                    return { status: 'ERROR', pesan: 'Akses Ditolak! Tingkat otoritas Anda tidak mencukupi untuk memuat data tabel ini.' };
                }
            }

            if (!CACHE_STRUKTUR_RAM[namaTabelSakti]) {
                const scanQuery = `SELECT column_name FROM information_schema.columns WHERE table_name = $1;`;
                const hasilScan = await db.query(scanQuery, [namaTabelSakti]);
                if (hasilScan.rows.length === 0) {
                    return { status: 'ERROR', pesan: `Akses Ditolak! Infrastruktur tabel '${namaTabelSakti}' tidak eksis di database.` };
                }
                CACHE_STRUKTUR_RAM[namaTabelSakti] = hasilScan.rows.map(row => row.column_name);
                console.log(`[MANDOR RECORD] [${timestamp}] Sukses mengunci skema tabel "${namaTabelSakti}" ke RAM.`);
            }

            const daftarKolomSah = CACHE_STRUKTUR_RAM[namaTabelSakti];
// backend/infrastructure/ipc/mandor-frontend.js (PART 2)
            if (aksi === 'ambil_data') {
                let stringKolomAman = daftarKolomSah.map(k => `"${k}"`).join(', ');
                
                if (suratPerintah.kolom_diminta && Array.isArray(suratPerintah.kolom_diminta) && suratPerintah.kolom_diminta.length > 0) {
                    const kolomTersaring = suratPerintah.kolom_diminta
                        .map(k => String(k).trim())
                        .filter(k => daftarKolomSah.includes(k));
                    if (kolomTersaring.length > 0) {
                        stringKolomAman = kolomTersaring.map(k => `"${k}"`).join(', ');
                    }
                }

                let kolomOrder = 'id ASC';
                if (daftarKolomSah.includes('sort_order')) {
                    kolomOrder = '"sort_order" ASC';
                } else if (daftarKolomSah.includes('id')) {
                    kolomOrder = '"id" ASC';
                } else if (daftarKolomSah.length > 0) {
                    kolomOrder = `"${daftarKolomSah[0]}" ASC`;
                }

                const querySakti = `SELECT ${stringKolomAman} FROM "${namaTabelSakti}" ORDER BY ${kolomOrder}`;
                const responDb = await db.query(querySakti);

                if (namaTabelSakti === 'app_menus') {
                    const barisMenuTersaring = responDb.rows.filter(menu => {
                        const roles = String(menu.roles_allowed || '').split(',').map(r => r.trim().toLowerCase());
                        const cleanRoleSesi = String(roleSesiAktif).trim().toLowerCase();

                        if (cleanRoleSesi === 'admin' || cleanRoleSesi === 'adminmaster') {
                            return roles.includes('all') || roles.includes('admin') || roles.includes('adminmaster');
                        }
                        return roles.includes('all') || roles.includes(cleanRoleSesi);
                    });
                    return { status: 'OK', data: barisMenuTersaring };
                }

                // Proteksi Infinite Loop: Jangan catat log jika sedang membaca tabel activity_log itu sendiri
                if (namaTabelSakti !== 'activity_log') {
                    await MandorFrontend.catatLogAktivitas(logUserId, logUsername, aksi, namaTabelSakti, 'SUCCESS');
                }
                return { status: 'OK', data: responDb.rows };
            }

            if (aksi === 'tambah_data') {
                const { data_input } = suratPerintah;
                if (!data_input || typeof data_input !== 'object' || Array.isArray(data_input)) {
                    return { status: 'ERROR', pesan: 'Struktur data input tidak valid.' };
                }
                
                const kolomInputSaring = Object.keys(data_input).filter(k => daftarKolomSah.includes(k.trim()));
                if (kolomInputSaring.length === 0) return { status: 'ERROR', pesan: 'Kolom input tidak cocok dengan skema DB!' };

                const queryInsert = `INSERT INTO "${namaTabelSakti}" (${kolomInputSaring.map(k => `"${k}"`).join(', ')}) VALUES (${kolomInputSaring.map((_, i) => `$${i + 1}`).join(', ')})`;
                await db.query(queryInsert, kolomInputSaring.map(k => data_input[k]));
                
                await MandorFrontend.catatLogAktivitas(logUserId, logUsername, aksi, namaTabelSakti, 'SUCCESS');
                return { status: 'OK', pesan: `Sukses menyimpan data ke tabel ${namaTabelSakti}!` };
            }

            if (aksi === 'hapus_data') {
                const { id_target } = suratPerintah;
                if (!id_target || !daftarKolomSah.includes('id')) return { status: 'ERROR', pesan: 'Operasi hapus tidak sah.' };
                
                const finalIdTarget = isNaN(Number(id_target)) ? String(id_target).trim() : parseInt(id_target, 10);
                await db.query(`DELETE FROM "${namaTabelSakti}" WHERE "id" = $1`, [finalIdTarget]);
                
                await MandorFrontend.catatLogAktivitas(logUserId, logUsername, aksi, namaTabelSakti, 'SUCCESS');
                return { status: 'OK', pesan: 'Data berhasil dihapus.' };
            }

            return { status: 'ERROR', pesan: 'Aksi tidak dikenali oleh Mandor.' };

        } catch (error) {
            console.error(`[MANDOR_FRONTEND_FATAL] [${timestamp}] Fatal Database Error: ${error.message}`);
            await MandorFrontend.catatLogAktivitas(logUserId, logUsername, aksi, namaTabelSakti, 'FAILED');
            
            setTimeout(() => { 
                db.emit('emergency_logout'); 
            }, 1000);
            
            return { status: 'ERROR', pesan: 'Gagal memproses manipulasi kueri internal data.' };
        }
    },

    handleExpressDynamicCRUD: async (req, res) => {
        const timestamp = new Date().toISOString();
        try {
            const suratPerintah = req.body;
            const currentSessionRole = req.user?.role || 'user';
            
            // Konfigurasi konteks user asil hasil urai JWT VPS untuk disalurkan ke sistem log
            const contextUser = {
                id: req.user?.id || null,
                username: req.user?.username || 'vps_client'
            };

            const result = await MandorFrontend.eksekusiMenuSpesifik(suratPerintah, currentSessionRole, contextUser);
            
            if (result && result.status === 'ERROR') {
                if (result.pesan.includes('Otoritas Anda tidak mencukupi') || result.pesan.includes('Akses Ditolak')) {
                    return res.status(403).json(result); 
                }
                return res.status(400).json(result); 
            }
            return res.status(200).json(result); 
        } catch (expressDynamicError) {
            console.error(`[EXPRESS_DYNAMIC_CRUD_FATAL] [${timestamp}] Kegagalan total API dinamis: ${expressDynamicError.message}`);
            return res.status(500).json({ 
                status: 'ERROR', 
                pesan: 'Terjadi kegagalan sistem internal VPS saat mengolah kueri dinamis.' 
            });
        }
    }
};

export default MandorFrontend;
