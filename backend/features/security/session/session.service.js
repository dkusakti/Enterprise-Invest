import crypto from 'crypto';
import sessionRepository from './session.repository.js';

const ACCESS_TTL_SECONDS = Number(process.env.JWT_ACCESS_EXPIRES_SECONDS || 900);
const REFRESH_TTL_SECONDS = Number(process.env.JWT_REFRESH_EXPIRES_SECONDS || 604800);

const sessionService = {
  accessTtlSeconds: ACCESS_TTL_SECONDS,
  refreshTtlSeconds: REFRESH_TTL_SECONDS,
  createOpaqueRefreshToken: () => crypto.randomBytes(48).toString('base64url'),
  createSession: async ({ userId, deviceFingerprint, userAgent, ipAddress }) => {
    const refreshToken = sessionService.createOpaqueRefreshToken();
    const expiresAt = new Date(Date.now() + REFRESH_TTL_SECONDS * 1000);
    const session = await sessionRepository.create({ userId, refreshToken, expiresAt, deviceFingerprint, userAgent, ipAddress });
    return { session, refreshToken, expiresAt };
  },
  revoke: (sessionId) => sessionRepository.revoke(sessionId),
  revokeAllForUser: (userId) => sessionRepository.revokeAllForUser(userId)
};

export default sessionService;
