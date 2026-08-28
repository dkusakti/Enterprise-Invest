import JwtTokenDto from './jwt-token.dto.js';
import jwtTokenService from './jwt-token.service.js';
import sessionService from '../session/session.service.js';
import db from '../../../database/pool.js';

const normalizeRole = (role) => String(role || 'user').trim().toLowerCase().replace(/\s+/g, '');

class JwtTokenController {
  async issueSessionToken(userData, options = {}) {
    try {
      const dto = new JwtTokenDto(userData);
      if (!dto.isValid()) return { success: false, error: 'Data user tidak valid.' };

      const sessionResult = await sessionService.createSession({
        userId: dto.id,
        deviceFingerprint: options.deviceFingerprint || userData?.fingerprint || null,
        userAgent: options.userAgent || null,
        ipAddress: options.ipAddress || null
      });
      const access = jwtTokenService.issueAccessToken(dto, sessionResult.session.id);
      return {
        success: true,
        accessToken: access.accessToken,
        refreshToken: sessionResult.refreshToken,
        expiresAt: access.expiresAt
      };
    } catch (error) {
      console.error(`[JWT_ISSUE_ERROR] ${error.message}`);
      return { success: false, error: 'Gagal membuat sesi autentikasi.' };
    }
  }

  async rotateSessionToken(refreshToken, metadata = {}) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const validation = await sessionService.validateRefreshToken(refreshToken);
      if (!validation.success) {
        if (validation.reused && validation.session?.user_id) {
          await client.query('UPDATE auth_sessions SET revoked_at = COALESCE(revoked_at, NOW()) WHERE user_id = $1 AND revoked_at IS NULL', [validation.session.user_id]);
        }
        await client.query('ROLLBACK');
        return { success: false, reused: validation.reused, expired: validation.expired, error: 'Refresh token tidak sah atau sudah tidak aktif.' };
      }

      const session = validation.session;
      const userResult = await client.query(
        `SELECT id, username, role FROM login WHERE id = $1 LIMIT 1`,
        [session.user_id]
      );
      const user = userResult.rows[0];
      if (!user) {
        await client.query('UPDATE auth_sessions SET revoked_at = NOW() WHERE id = $1', [session.id]);
        await client.query('COMMIT');
        return { success: false, error: 'Akun sesi tidak ditemukan.' };
      }

      const role = normalizeRole(user.role);
      const dto = new JwtTokenDto({ ...user, role });
      if (!dto.isValid()) {
        await client.query('ROLLBACK');
        return { success: false, error: 'Role akun tidak valid.' };
      }

      const nextRefresh = sessionService.createOpaqueRefreshToken();
      const nextExpires = new Date(Date.now() + sessionService.refreshTtlSeconds * 1000);
      const inserted = await client.query(
        `INSERT INTO auth_sessions
          (user_id, refresh_token_hash, expires_at, device_fingerprint, user_agent, ip_address)
         VALUES ($1, encode(digest($2, 'sha256'), 'hex'), $3, $4, $5, $6)
         RETURNING id`,
        [dto.id, nextRefresh, nextExpires, session.device_fingerprint, metadata.userAgent || session.user_agent, metadata.ipAddress || session.ip_address]
      );
      const nextSessionId = inserted.rows[0].id;
      const access = jwtTokenService.issueAccessToken(dto, nextSessionId);

      const revoked = await client.query(
        `UPDATE auth_sessions
            SET revoked_at = NOW(), replaced_by = $2, last_used_at = NOW()
          WHERE id = $1 AND revoked_at IS NULL`,
        [session.id, nextSessionId]
      );
      if (revoked.rowCount !== 1) {
        await client.query('ROLLBACK');
        return { success: false, reused: true, error: 'Refresh token sudah digunakan.' };
      }

      await client.query('COMMIT');
      return { success: true, accessToken: access.accessToken, refreshToken: nextRefresh, expiresAt: access.expiresAt };
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch {}
      console.error(`[JWT_ROTATION_ERROR] ${error.message}`);
      return { success: false, error: 'Gagal melakukan rotasi sesi.' };
    } finally {
      client.release();
    }
  }

  async revokeSession(refreshToken) {
    const validation = await sessionService.validateRefreshToken(refreshToken);
    if (validation.session?.id) await sessionService.revoke(validation.session.id);
    return { success: true };
  }

  async validateActiveToken(token) {
    return jwtTokenService.verifyAccessToken(token);
  }

  expressAuthenticateToken = async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
      if (!token) return res.status(401).json({ success: false, error: 'Token autentikasi diperlukan.' });

      const validation = await this.validateActiveToken(token);
      if (!validation.success) return res.status(validation.expired ? 401 : 403).json({ success: false, expired: validation.expired || false, error: validation.error });

      const active = await db.query(
        `SELECT l.id, l.username, l.role
           FROM login l
           JOIN auth_sessions s ON s.user_id = l.id
          WHERE s.id = $1 AND s.revoked_at IS NULL AND s.expires_at > NOW()
            AND l.id = $2
          LIMIT 1`,
        [validation.user.sessionId, validation.user.id]
      );
      if (active.rowCount !== 1) return res.status(401).json({ success: false, error: 'Sesi sudah dicabut atau tidak aktif.' });

      req.user = {
        id: Number(active.rows[0].id),
        username: String(active.rows[0].username),
        role: normalizeRole(active.rows[0].role),
        sessionId: validation.user.sessionId,
        jti: validation.user.jti
      };
      return next();
    } catch (error) {
      console.error(`[EXPRESS_JWT_AUTH_ERROR] ${error.message}`);
      return res.status(500).json({ success: false, error: 'Gagal memvalidasi sesi.' });
    }
  };

  expressRotateSessionToken = async (req, res) => {
    try {
      const refreshToken = String(req.body?.refreshToken || '');
      if (!refreshToken) return res.status(400).json({ success: false, error: 'Refresh token wajib disertakan.' });
      const result = await this.rotateSessionToken(refreshToken, {
        userAgent: req.get('user-agent') || null,
        ipAddress: req.ip || null
      });
      return res.status(result.success ? 200 : (result.reused ? 401 : 401)).json(result);
    } catch (error) {
      console.error(`[EXPRESS_REFRESH_ERROR] ${error.message}`);
      return res.status(500).json({ success: false, error: 'Kesalahan internal saat refresh sesi.' });
    }
  };
}

export default new JwtTokenController();
