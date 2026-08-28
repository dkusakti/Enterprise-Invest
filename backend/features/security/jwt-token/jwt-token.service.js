import jwt from 'jsonwebtoken';
import JwtTokenDto from './jwt-token.dto.js';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ISSUER = process.env.JWT_ISSUER || 'enterprise-invest';
const AUDIENCE = process.env.JWT_AUDIENCE || 'enterprise-invest-client';

if (!ACCESS_SECRET || !REFRESH_SECRET) throw new Error('JWT_ACCESS_SECRET dan JWT_REFRESH_SECRET wajib dikonfigurasi.');
if (ACCESS_SECRET.length < 32 || REFRESH_SECRET.length < 32) throw new Error('JWT secret harus minimal 32 karakter.');

const normalizeRole = (role) => String(role || 'user').trim().toLowerCase().replace(/\s+/g, '');

class JwtTokenService {
  constructor() {
    this.accessSecret = ACCESS_SECRET;
    this.refreshSecret = REFRESH_SECRET;
    this.accessExpiresIn = Number(process.env.JWT_ACCESS_EXPIRES_SECONDS || 900);
  }

  createAccessToken(user, sessionId) {
    const dto = new JwtTokenDto({ ...user, role: normalizeRole(user.role) });
    if (!dto.isValid()) throw new Error('Data user tidak valid untuk access token.');
    return jwt.sign(
      { typ: 'access', username: dto.username, role: dto.role, sid: String(sessionId) },
      this.accessSecret,
      { algorithm: 'HS512', subject: String(dto.id), issuer: ISSUER, audience: AUDIENCE, expiresIn: this.accessExpiresIn }
    );
  }

  issueAccessToken(user, sessionId) {
    const accessToken = this.createAccessToken(user, sessionId);
    return { accessToken, expiresAt: Date.now() + this.accessExpiresIn * 1000 };
  }

  verifyAccessToken(token) {
    try {
      const payload = jwt.verify(token, this.accessSecret, {
        algorithms: ['HS512'], issuer: ISSUER, audience: AUDIENCE
      });
      if (payload.typ !== 'access' || !payload.sid || !payload.sub) throw new Error('Tipe token atau session tidak valid.');
      return {
        success: true,
        user: {
          id: Number(payload.sub),
          username: String(payload.username || ''),
          role: normalizeRole(payload.role),
          sessionId: String(payload.sid),
          jti: String(payload.jti || '')
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
