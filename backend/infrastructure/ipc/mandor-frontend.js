import db from '../../database/pool.js';

const CACHE_STRUKTUR_RAM = new Map();
const PROTECTED_TABLES = new Set(['login', 'auth_sessions', 'schema_migrations']);
const SENSITIVE_COLUMNS = new Set(['password', 'password_hash', 'refresh_token', 'refresh_token_hash', 'otp_secret']);
const ROLE_ALIASES = { admin: 'adminmaster', master_admin: 'adminmaster', super_user: 'superuser' };
const normalizeRole = (role) => {
  const normalized = String(role || 'user').trim().toLowerCase().replace(/\s+/g, '');
  return ROLE_ALIASES[normalized] || normalized;
};
const quoteIdentifier = (value) => `"${String(value).replace(/"/g, '""')}"`;
const audit = async (user, action, table, status) => {
  try {
    await db.query(
      `INSERT INTO activity_log (user_id, username, action_name, target_table, status) VALUES ($1,$2,$3,$4,$5)`,
      [user?.id || null, user?.username || 'unknown_user', String(action), String(table), String(status)]
    );
  } catch (error) { console.error(`[AUDIT_LOG_FAILURE] ${error.message}`); }
};

const MandorFrontend = {
  catatLogAktivitas: audit,

  eksekusiMenuSpesifik: async (suratPerintah, currentSessionRole, contextUser = {}) => {
    const timestamp = new Date().toISOString();
    if (!suratPerintah || typeof suratPerintah !== 'object' || Array.isArray(suratPerintah)) return { status: 'ERROR', pesan: 'Surat perintah tidak valid.' };
    const { aksi, target_tabel: targetTable } = suratPerintah;
    const table = String(targetTable || '').trim().toLowerCase();
    const role = normalizeRole(currentSessionRole);
    if (!table || !['ambil_data', 'tambah_data', 'hapus_data'].includes(aksi)) return { status: 'ERROR', pesan: 'Operasi CRUD tidak valid.' };
    if (!/^[a-z_][a-z0-9_]{0,62}$/.test(table)) return { status: 'ERROR', pesan: 'Nama tabel tidak valid.' };
    if (PROTECTED_TABLES.has(table)) return { status: 'ERROR', pesan: 'Akses ke tabel sistem ditolak.' };

    try {
      // DENY-BY-DEFAULT: setiap tabel yang dapat dipakai CRUD harus terdaftar di app_menus.
      const menu = await db.query(`SELECT roles_allowed FROM app_menus WHERE LOWER(folder_name) = $1 LIMIT 1`, [table]);
      if (menu.rowCount !== 1) {
        await audit(contextUser, aksi, table, 'BLOCKED_TABLE_NOT_WHITELISTED');
        return { status: 'ERROR', pesan: 'Tabel tidak terdaftar sebagai resource aplikasi.' };
      }
      const allowedRoles = String(menu.rows[0].roles_allowed || '').split(',').map(normalizeRole).filter(Boolean);
      const roleAllowed = allowedRoles.includes('all') || allowedRoles.includes(role) || (role === 'adminmaster' && allowedRoles.includes('admin'));
      if (!roleAllowed) {
        await audit(contextUser, aksi, table, 'BLOCKED_ROLE');
        return { status: 'ERROR', pesan: 'Akses Ditolak! Tingkat otoritas tidak mencukupi.' };
      }

      if (aksi === 'hapus_data' && !['owner', 'adminmaster'].includes(role)) {
        await audit(contextUser, aksi, table, 'BLOCKED_DELETE');
        return { status: 'ERROR', pesan: 'Hanya owner/adminmaster yang dapat menghapus data.' };
      }

      if (!CACHE_STRUKTUR_RAM.has(table)) {
        const schema = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`, [table]);
        if (!schema.rowCount) return { status: 'ERROR', pesan: 'Resource database tidak ditemukan.' };
        CACHE_STRUKTUR_RAM.set(table, schema.rows.map((row) => row.column_name));
      }
      const columns = CACHE_STRUKTUR_RAM.get(table);
      const safeColumns = columns.filter((column) => !SENSITIVE_COLUMNS.has(column.toLowerCase()));

      if (aksi === 'ambil_data') {
        let requested = Array.isArray(suratPerintah.kolom_diminta) ? suratPerintah.kolom_diminta.map(String) : safeColumns;
        requested = requested.map((column) => column.trim()).filter((column) => safeColumns.includes(column));
        if (!requested.length) return { status: 'ERROR', pesan: 'Tidak ada kolom yang diizinkan.' };
        const orderColumn = columns.includes('sort_order') ? 'sort_order' : (columns.includes('id') ? 'id' : columns[0]);
        const limit = Math.min(Math.max(Number(suratPerintah.limit) || 100, 1), 500);
        const offset = Math.max(Number(suratPerintah.offset) || 0, 0);
        const sql = `SELECT ${requested.map(quoteIdentifier).join(', ')} FROM ${quoteIdentifier(table)} ORDER BY ${quoteIdentifier(orderColumn)} ASC LIMIT $1 OFFSET $2`;
        const result = await db.query(sql, [limit, offset]);
        if (table !== 'activity_log') await audit(contextUser, aksi, table, 'SUCCESS');
        return { status: 'OK', data: result.rows, pagination: { limit, offset, returned: result.rowCount } };
      }

      if (aksi === 'tambah_data') {
        if (table === 'activity_log') return { status: 'ERROR', pesan: 'Audit log tidak dapat dimanipulasi melalui CRUD dinamis.' };
        const input = suratPerintah.data_input;
        if (!input || typeof input !== 'object' || Array.isArray(input)) return { status: 'ERROR', pesan: 'data_input tidak valid.' };
        const keys = Object.keys(input).filter((key) => safeColumns.includes(key) && key !== 'id');
        if (!keys.length) return { status: 'ERROR', pesan: 'Tidak ada kolom input yang diizinkan.' };
        const sql = `INSERT INTO ${quoteIdentifier(table)} (${keys.map(quoteIdentifier).join(', ')}) VALUES (${keys.map((_, index) => `$${index + 1}`).join(', ')}) RETURNING *`;
        const result = await db.query(sql, keys.map((key) => input[key]));
        await audit(contextUser, aksi, table, 'SUCCESS');
        return { status: 'OK', data: result.rows[0] };
      }

      if (table === 'activity_log') return { status: 'ERROR', pesan: 'Audit log tidak dapat dihapus.' };
      const id = suratPerintah.id_target;
      if (id === undefined || id === null || !columns.includes('id')) return { status: 'ERROR', pesan: 'id_target wajib dan tabel harus memiliki kolom id.' };
      const result = await db.query(`DELETE FROM ${quoteIdentifier(table)} WHERE ${quoteIdentifier('id')} = $1 RETURNING id`, [id]);
      if (!result.rowCount) return { status: 'ERROR', pesan: 'Data tidak ditemukan.' };
      await audit(contextUser, aksi, table, 'SUCCESS');
      return { status: 'OK', pesan: 'Data berhasil dihapus.', id: result.rows[0].id };
    } catch (error) {
      console.error(`[MANDOR_FRONTEND_FATAL] [${timestamp}] ${error.message}`);
      await audit(contextUser, aksi, table, 'FAILED');
      return { status: 'ERROR', pesan: 'Gagal memproses operasi database.' };
    }
  },

  handleExpressDynamicCRUD: async (req, res) => {
    try {
      const result = await MandorFrontend.eksekusiMenuSpesifik(req.body, req.user?.role, req.user);
      const status = result.status === 'ERROR' ? (result.pesan.includes('Ditolak') || result.pesan.includes('tidak terdaftar') ? 403 : 400) : 200;
      return res.status(status).json(result);
    } catch {
      return res.status(500).json({ status: 'ERROR', pesan: 'Kegagalan internal CRUD.' });
    }
  }
};

export default MandorFrontend;
