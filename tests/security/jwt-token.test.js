import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-only-secret-change-this-value-1234567890';
process.env.JWT_ACCESS_EXPIRES_SECONDS = '900';
process.env.JWT_ISSUER = 'enterprise-invest';
process.env.JWT_AUDIENCE = 'enterprise-invest-client';

const { default: jwtTokenService } = await import('../../backend/features/security/jwt-token/jwt-token.service.js');

test('access token is HS512 and contains session binding', () => {
  const token = jwtTokenService.createAccessToken({ id: 7, username: 'tester', role: 'owner' }, 99);
  const decoded = jwt.decode(token, { complete: true });
  assert.equal(decoded.header.alg, 'HS512');
  assert.equal(decoded.payload.typ, 'access');
  assert.equal(decoded.payload.sub, '7');
  assert.equal(decoded.payload.sid, '99');
  assert.ok(decoded.payload.jti);
  assert.equal(decoded.payload.role, undefined);
});

test('access token rejects a refresh-token-shaped opaque value', () => {
  const result = jwtTokenService.verifyAccessToken('A'.repeat(64));
  assert.equal(result.success, false);
});

test('access token rejects a wrong audience', () => {
  const token = jwt.sign(
    { typ: 'access', sid: '99' },
    process.env.JWT_ACCESS_SECRET,
    { algorithm: 'HS512', subject: '7', jwtid: 'test-jti', issuer: process.env.JWT_ISSUER, audience: 'wrong-audience', expiresIn: 900 }
  );
  assert.equal(jwtTokenService.verifyAccessToken(token).success, false);
});
