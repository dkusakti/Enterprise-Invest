import crypto from 'crypto';
import sessionRepository from './session.repository.js';

const parsePositiveInt = (name, fallback, min, max) => {
  const value = Number(process.env[name] || fallback);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} harus antara ${min} dan ${max}.`);
  return value;
};

const ACCESS_TTL_SECONDS = parsePositiveInt('JWT_ACCESS_EXPIRES_SECONDS', 900, 60, 3600);
const REFRESH_TTL_SECONDS = parsePositiveInt('JWT_REFRESH_EXPIRES_SECONDS', 604800, 3600, 2592000);

const sessionService = {
  accessTtlSeconds: ACCESS_TTL_SECONDS,
  refreshTtlSeconds: REFRESH_TTL_SECONDS,
  createOpaqueRefreshToken: () => crypto.randomBytes(48).toString('base64url'),
  createSession: async ({ userId, deviceFingerprint = null, userAgent = null, ipAddress = null }) => {
    if (!Number.isSafeInteger(Number(userId)) || Number(userId) <= 0) throw new Error('User ID session tidak valid.');
    const refreshToken = sessionService.createOpaqueRefreshToken();
    const expiresAt = new Date(Date.now() + REFRESH_TTL_SECONDS * 1000);
    const session = await sessionRepository.create({ userId: Number(userId), refreshToken, expiresAt, deviceFingerprint, userAgent, ipAddress });
    return { session, refreshToken, expiresAt };
  },
  revoke: (sessionId) => sessionRepository.revoke(sessionId),
  revokeAllForUser: (userId) => sessionRepository.revokeAllForUser(userId)
};

export default sessionService;
