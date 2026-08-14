// backend/features/security/jwt-token/jwt-token.controller.js
import JwtTokenDto from './jwt-token.dto.js';
import jwtTokenService from './jwt-token.service.js';

class JwtTokenController {
  /**
   * Menangani permintaan pembuatan sepasang token akses dan refresh token (Untuk IPC & Express)
   * @param {Object} userData - Data mentah objek karyawan dari database/kernel
   * @param {Boolean} isRefresh - Penanda kaku apakah ini merupakan proses rotasi token otomatis (Silent Refresh)
   */
  async issueSessionToken(userData, isRefresh = false) {
    const timestamp = new Date().toISOString();
    try {
      // 1. Saring struktur payload pengguna via DTO Kelas
      const sanitizedDto = new JwtTokenDto(userData);
      
      // SINKRONISASI PENUH: Tangkap string refresh token lama milik user jika ini merupakan fase rotasi otomatis
      const rawRefreshToken = isRefresh ? String(userData?.refreshToken || '') : '';
      
      // 2. Teruskan parameter penanda dan token aslinya ke dalam Service Layer agar tidak bernilai undefined
      return await jwtTokenService.issueTokens(sanitizedDto, isRefresh, rawRefreshToken);
    } catch (error) {
      console.error(`🚨 [JWT CONTROLLER ERROR - ISSUE] [${timestamp}]: ${error.message}`);
      return { success: false, error: 'Gagal mengeksekusi pembuatan token.' };
    }
  }

  /**
   * Menangani validasi ketat tanda tangan digital kriptografi token JWT (Untuk IPC & Express)
   * @param {String} token - String token JWT (Header.Payload.Signature) yang dicek
   */
  async validateActiveToken(token) {
    const timestamp = new Date().toISOString();
    try {
      return await jwtTokenService.verifyToken(token);
    } catch (error) {
      console.error(`🚨 [JWT CONTROLLER ERROR - VERIFY] [${timestamp}]: ${error.message}`);
      return { success: false, expired: true, error: 'Integritas token rusak.' };
    }
  }

  /**
   * STRATEGI VPS: Middleware Proteksi Rute Express (Otorisasi JWT)
   * Mencegat dan memeriksa keabsahan token JWT sebelum mengizinkan akses ke rute VPS internal
   */
  expressAuthenticateToken = async (req, res, next) => {
    const timestamp = new Date().toISOString();
    try {
      // Ambil string token dari header Authorization standar HTTP
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

      if (!token) {
        console.warn(`[EXPRESS_JWT_WARN] [${timestamp}] Request ditolak. Klien mencoba masuk tanpa Authorization Header.`);
        return res.status(401).json({ success: false, error: 'Akses Ditolak: Token otentikasi tidak ditemukan.' });
      }

      // Validasi token via fungsi internal kontroler yang sudah stabil
      const validation = await this.validateActiveToken(token);

      if (!validation || !validation.success) {
        console.warn(`[EXPRESS_JWT_WARN] [${timestamp}] Hak otorisasi ditolak. Sesi ilegal atau kadaluwarsa.`);
        return res.status(403).json({ 
          success: false, 
          expired: validation?.expired || false, 
          error: validation?.error || 'Akses Ditolak: Sesi tidak sah atau kedaluwarsa.' 
        });
      }

      // SINKRONISASI KONTEKS: Tempelkan data payload user yang bersih ke dalam objek request Express
      // Data ini yang dikonsumsi oleh req.user.role pada modul reset-hardware dll.
      req.user = validation.user;

      if (typeof next === 'function') return next();
      return res.status(200).json({ success: true, message: 'Token valid.' });

    } catch (expressJwtError) {
      console.error(`🚨 [EXPRESS JWT AUTH MIDDLEWARE FATAL] [${timestamp}]: ${expressJwtError.message}`);
      return res.status(500).json({ success: false, error: 'Kegagalan sistem internal VPS pada otorisasi token.' });
    }
  };

  /**
   * STRATEGI VPS: Endpoint Express untuk rotasi token otomatis (Silent Refresh) via HTTP POST
   */
  expressRotateSessionToken = async (req, res) => {
    const timestamp = new Date().toISOString();
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({ success: false, error: 'Refresh token wajib disertakan.' });
      }

      // SINKRONISASI SEKURITI: Validasi keaslian refresh token lama dan ekstrak payload profil aslinya 
      // dari database/memori agar tidak memicu error data kosong di level DTO.
      const tokenVerification = await this.validateActiveToken(refreshToken);
      if (!tokenVerification || !tokenVerification.success) {
        console.warn(`[EXPRESS_JWT_WARN] [${timestamp}] Permintaan rotasi token ditolak. Token refresh mati atau ilegal.`);
        return res.status(401).json({ success: false, error: 'Refresh token tidak sah atau sudah kedaluwarsa.' });
      }

      // Gabungkan profil asli user yang berhasil divalidasi ke dalam payload rotasi token
      const rotationPayload = {
        id: tokenVerification.user.id,
        username: tokenVerification.user.username,
        role: tokenVerification.user.role,
        refreshToken: refreshToken
      };

      // Jalankan penerbitan token baru dengan mode rotasi isRefresh = true
      const result = await this.issueSessionToken(rotationPayload, true);

      if (!result || !result.success) {
        return res.status(401).json({ success: false, error: result?.error || 'Gagal memperbarui sesi token.' });
      }

      console.log(`[EXPRESS_JWT_SUCCESS] [${timestamp}] Sesi token akses berhasil diperbarui otomatis untuk user ID: [${tokenVerification.user.id}].`);
      return res.status(200).json(result);

    } catch (expressRefreshError) {
      console.error(`🚨 [EXPRESS JWT REFRESH CONTROLLER FATAL] [${timestamp}]: ${expressRefreshError.message}`);
      return res.status(500).json({ success: false, error: 'Terjadi kesalahan sistem VPS saat rotasi token.' });
    }
  };
}

// Ekspor instans tunggal siap pakai di level kernel main.js dan Server Express Anda
export default new JwtTokenController();
