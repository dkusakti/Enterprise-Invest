import crypto from 'crypto';
import db from '../../../database/pool.js';

const hashRefreshToken = (token) => crypto.createHash('sha256').update(String(token), 'utf8').digest('hex');

const sessionRepository = {
  hashRefreshToken,
  create: async ({ userId, refreshToken, expiresAt, deviceFingerprint = null, userAgent = null, ipAddress = null }) => {
    const result = await db.query(
      `INSERT INTO auth_sessions (user_id, refresh_token_hash, expires_at, device_fingerprint, user_agent, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, user_id, expires_at, created_at`,
      [userId, hashRefreshToken(refreshToken), expiresAt, deviceFingerprint, userAgent, ipAddress]
    );
    return result.rows[0];
  },
  findForUpdate: async (client, refreshToken) => {
    const result = await client.query(
      `SELECT id, user_id, refresh_token_hash, expires_at, revoked_at, device_fingerprint, user_agent, ip_address
         FROM auth_sessions WHERE refresh_token_hash = $1 FOR UPDATE`,
      [hashRefreshToken(refreshToken)]
    );
    return result.rows[0] || null;
  },
  revoke: async (sessionId) => db.query(`UPDATE auth_sessions SET revoked_at = COALESCE(revoked_at, NOW()), last_used_at = NOW() WHERE id = $1`, [sessionId]),
  revokeAllForUser: async (userId) => db.query(`UPDATE auth_sessions SET revoked_at = COALESCE(revoked_at, NOW()), last_used_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`, [userId])
};

export default sessionRepository;
