// backend/features/owner/settings/account-manager/account-manager.controller.js
import dbPool from '../../../../database/pool.js';

import bcrypt from 'bcryptjs';

const accountManagerController = {
  /**
   * Pembuatan akun baru otomatis (HANYA OWNER)
   * Format Username: DDMMYYNN (Tanggal, Bulan, Tahun, Nomor Urut)
   */
  registerNewUser: async (req, res) => {
    const timestamp = new Date().toISOString();
    try {
      // 🔒 SEKURITI LAPIS ATAS: Kunci mutlak hanya untuk role Owner
      const currentSessionRole = String(req.user?.role || '').trim().toLowerCase();
      if (currentSessionRole !== 'owner') {
        return res.status(403).json({ success: false, error: 'AKSES DITOLAK: Hanya Owner yang berhak membuat akun baru!' });
      }

      const { role, passwordDefault } = req.body;
      const cleanRole = String(role || 'user').trim().toLowerCase();
      const cleanPassword = String(passwordDefault || 'Invest2026').trim();

      if (!['adminmaster', 'superuser', 'user'].includes(cleanRole)) {
        return res.status(400).json({ success: false, error: 'Format kasta peran tidak valid.' });
      }

      // Generate format DDMMYY berdasarkan tanggal hari ini
      const sekarang = new Date();
      const tgl = String(sekarang.getDate()).padStart(2, '0');
      const bln = String(sekarang.getMonth() + 1).padStart(2, '0');
      const thn = String(sekarang.getFullYear()).slice(-2);
      const polaTanggal = `${tgl}${bln}${thn}`; // Hasil: 240726

      // Hitung total urutan akun yang dibuat hari ini untuk menentukan nomor urut (NN)
      const queryHitung = `SELECT COUNT(*)::integer AS total FROM login WHERE username LIKE $1;`;
      const hitungRes = await dbPool.query(queryHitung, [`${polaTanggal}%`]);
      const urutanBerikutnya = (parseInt(hitungRes.rows[0]?.total || '0', 10) + 1);
      const stringUrutan = String(urutanBerikutnya).padStart(2, '0');

      const usernameFinal = `${polaTanggal}${stringUrutan}`; // Hasil Akhir: 24072601

      // Lakukan enkripsi kaku Bcrypt untuk password default
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(cleanPassword, salt);

      // Simpan entitas akun baru ke PostgreSQL
      const queryInsert = `INSERT INTO login (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id;`;
      const insertRes = await dbPool.query(queryInsert, [usernameFinal, passwordHash, cleanRole]);

      console.log(`[USER_REGISTER_SUCCESS] [${timestamp}] Owner berhasil mencetak akun baru: "${usernameFinal}" dengan peran: [${cleanRole}]`);
      
      return res.status(201).json({
        success: true,
        username: usernameFinal,
        password: cleanPassword,
        role: cleanRole
      });

    } catch (err) {
      console.error(`[ACCOUNT_REGISTER_FATAL] [${timestamp}] Gagal mendaftarkan pengguna baru: ${err.message}`);
      return res.status(500).json({ success: false, error: 'Kesalahan internal server saat mendaftarkan akun.' });
    }
  },

  /**
   * Rute Umum: Modul Penggantian Kata Sandi Mandiri (Bcrypt Compare & Update)
   */
  changePasswordSelf: async (req, res) => {
    const timestamp = new Date().toISOString();
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ success: false, error: 'Sesi ilegal atau tidak terotentikasi.' });
      }

      const userId = parseInt(req.user.id, 10);
      const { sandiLama, sandiBaru } = req.body;

      if (!sandiLama || !sandiBaru || String(sandiBaru).length < 6) {
        return res.status(400).json({ success: false, error: 'Kata sandi baru minimal wajib 6 karakter!' });
      }

      // Tarik hash password lama dari DB
      const queryCheck = `SELECT password_hash FROM login WHERE id = $1 LIMIT 1;`;
      const checkRes = await dbPool.query(queryCheck, [userId]);

      if (checkRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Identitas pengguna tidak ditemukan.' });
      }

      const currentHash = checkRes.rows[0].password_hash;

      // Bandingkan sandi ketikan dengan hash DB asli via Bcrypt
      const isMatch = await bcrypt.compare(String(sandiLama), currentHash);
      if (!isMatch) {
        return res.status(400).json({ success: false, error: 'Kata sandi lama yang Anda masukkan salah!' });
      }

      // Hash sandi baru yang segar
      const salt = await bcrypt.genSalt(10);
      const newHash = await bcrypt.hash(String(sandiBaru), salt);

      // Update kolom password_hash di PostgreSQL
      const queryUpdate = `UPDATE login SET password_hash = $1 WHERE id = $2;`;
      await dbPool.query(queryUpdate, [newHash, userId]);

      console.log(`[PASSWORD_UPDATE_SUCCESS] [${timestamp}] User ID: [${userId}] berhasil memperbarui kata sandi.`);
      return res.status(200).json({ success: true, message: 'Kata sandi berhasil diperbarui.' });

    } catch (err) {
      console.error(`[PASSWORD_UPDATE_FATAL] [${timestamp}] Gagal memperbarui kata sandi: ${err.message}`);
      return res.status(500).json({ success: false, error: 'Kesalahan internal server saat memperbarui kata sandi.' });
    }
  }
};

export default accountManagerController;
