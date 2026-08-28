import crypto from 'crypto';
import sessionRepository from './session.repository.js';

const ACCESS_TTL_SECONDS = Number(process.env.JWT_ACCESS_EXPIRES_SECONDS || 900);
const REFRESH_TTL_SECONDS = Number(process.env.JWT_REFRESH_EXPIRES_SECONDS || 604800);

const createOpaqueRefreshToken = () => crypto.randomBytes(48).toString('base64url');

const sessionService = {
  accessTtlSeconds: ACCESS_TTL_SECONDS,
  refreshTtlSeconds: REFRESH_TTL_SECONDS,
  createOpaqueRefreshToken,

  async createSession({ userId, deviceFingerprint, userAgent, ipAddress }) {
    const refreshToken = createOpaqueRefreshToken();
    const expiresAt = new Date(Date.now() + REFRESH_TTL_SECONDS * 1000);
    const session = await sessionRepository.create({
      userId,
      refreshToken,
      expiresAt,
      deviceFingerprint,
      userAgent,
      ipAddress
    });
    return { session, refreshToken, expiresAt };
  },

  async validateRefreshToken(refreshToken) {
    if (!refreshToken || typeof refreshToken !== 'string' || refreshToken.length < 40) {
      return { success: false, error: 'Refresh token tidak valid.' };
    }
    const session = await sessionRepository.findForUpdate(refreshToken);
    if (!session) return { success: false, error: 'Sesi tidak ditemukan.' };
    if (session.revoked_at) return { success: false, reused: true, session };
    if (new Date(session.expires_at).getTime() <= Date.now()) {
      return { success: false, expired: true, session };
    }
    return { success: true, session };
  },

  async revoke(sessionId) {
    return sessionRepository.revoke(sessionId);
  },

  async revokeAllForUser(userId) {
    return sessionRepository.revokeAllForUser(userId);
  }
};

export default sessionService;
