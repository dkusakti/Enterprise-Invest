import crypto from 'crypto';
import db from '../../../database/pool.js';

const hashRefreshToken = (token) =>
  crypto.createHash('sha256').update(String(token), 'utf8').digest('hex');

const sessionRepository = {
  create: async ({ userId, refreshToken, expiresAt, deviceFingerprint = null, userAgent = null, ipAddress = null }) => {
    const refreshTokenHash = hashRefreshToken(refreshToken);
    const result = await db.query(
      `INSERT INTO auth_sessions
        (user_id, refresh_token_hash, expires_at, device_fingerprint, user_agent, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, user_id, expires_at, created_at`,
      [userId, refreshTokenHash, expiresAt, deviceFingerprint, userAgent, ipAddress]
    );
    return result.rows[0];
  },

  findForUpdate: async (refreshToken) => {
    const hash = hashRefreshToken(refreshToken);
    const result = await db.query(
      `SELECT id, user_id, refresh_token_hash, expires_at, revoked_at,
              device_fingerprint, user_agent, ip_address
         FROM auth_sessions
        WHERE refresh_token_hash = $1
        FOR UPDATE`,
      [hash]
    );
    return result.rows[0] || null;
  },

  markRotated: async (sessionId, replacementSessionId) => {
    const result = await db.query(
      `UPDATE auth_sessions
          SET revoked_at = NOW(),
              replaced_by = $2,
              last_used_at = NOW()
        WHERE id = $1 AND revoked_at IS NULL
        RETURNING id`,
      [sessionId, replacementSessionId]
    );
    return result.rowCount === 1;
  },

  touch: async (sessionId) => {
    await db.query(`UPDATE auth_sessions SET last_used_at = NOW() WHERE id = $1`, [sessionId]);
  },

  revoke: async (sessionId) => {
    await db.query(
      `UPDATE auth_sessions SET revoked_at = COALESCE(revoked_at, NOW()), last_used_at = NOW() WHERE id = $1`,
      [sessionId]
    );
  },

  revokeAllForUser: async (userId) => {
    await db.query(
      `UPDATE auth_sessions SET revoked_at = COALESCE(revoked_at, NOW()), last_used_at = NOW()
        WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId]
    );
  },

  isActive: async (sessionId, userId) => {
    const result = await db.query(
      `SELECT id FROM auth_sessions
        WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL AND expires_at > NOW()
        LIMIT 1`,
      [sessionId, userId]
    );
    return result.rowCount === 1;
  }
};

export default sessionRepository;
export { hashRefreshToken };
