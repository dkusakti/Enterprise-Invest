import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import JwtTokenDto from './jwt-token.dto.js';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const ISSUER = process.env.JWT_ISSUER || 'enterprise-invest';
const AUDIENCE = process.env.JWT_AUDIENCE || 'enterprise-invest-client';

if (!ACCESS_SECRET || ACCESS_SECRET.length < 32) {
  throw new Error('JWT_ACCESS_SECRET wajib dikonfigurasi dan minimal 32 karakter.');
}

const normalizeRole = (role) => String(role || 'user').trim().toLowerCase().replace(/\s+/g, '');

class JwtTokenService {
  constructor() {
    this.accessSecret = ACCESS_SECRET;
    this.accessExpiresIn = Number(process.env.JWT_ACCESS_EXPIRES_SECONDS || 900);
    if (!Number.isInteger(this.accessExpiresIn) || this.accessExpiresIn < 60 || this.accessExpiresIn > 3600) {
      throw new Error('JWT_ACCESS_EXPIRES_SECONDS harus antara 60 dan 3600 detik.');
    }
  }

  createAccessToken(user, sessionId) {
    const dto = new JwtTokenDto({ ...user, role: normalizeRole(user.role) });
    if (!dto.isValid() || !sessionId) throw new Error('Data user/session tidak valid untuk access token.');
    return jwt.sign(
      { typ: 'access', username: dto.username, role: dto.role, sid: String(sessionId) },
      this.accessSecret,
      {
        algorithm: 'HS512',
        subject: String(dto.id),
        jwtid: crypto.randomUUID(),
        issuer: ISSUER,
        audience: AUDIENCE,
        expiresIn: this.accessExpiresIn
      }
    );
  }

  issueAccessToken(user, sessionId) {
    const accessToken = this.createAccessToken(user, sessionId);
    return { accessToken, expiresAt: Date.now() + this.accessExpiresIn * 1000 };
  }

  verifyAccessToken(token) {
    try {
      if (typeof token !== 'string' || token.length < 20 || token.length > 8192) throw new Error('Invalid token format');
      const payload = jwt.verify(token, this.accessSecret, {
        algorithms: ['HS512'],
        issuer: ISSUER,
        audience: AUDIENCE,
        complete: false
      });
      if (payload.typ !== 'access' || !payload.sid || !payload.sub || !payload.jti) throw new Error('Invalid access token claims');
      const id = Number(payload.sub);
      if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Invalid subject');
      return {
        success: true,
        user: {
          id,
          username: String(payload.username || ''),
          role: normalizeRole(payload.role),
          sessionId: String(payload.sid),
          jti: String(payload.jti)
        }
      };
    } catch (error) {
      return { success: false, expired: error.name === 'TokenExpiredError', error: 'Token akses tidak sah atau kedaluwarsa.' };
    }
  }

  async verifyToken(token) {
    return this.verifyAccessToken(token);
  }
}

export default new JwtTokenService();
