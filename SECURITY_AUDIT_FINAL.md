# Enterprise-Invest — Security Audit Final v3

## Branch policy

This branch is isolated from `main`. No changes from this audit are intended to be merged automatically.

## Security scope

- JWT access-token verification uses HS512 with issuer/audience validation, `jti`, `sid`, and a short configurable TTL.
- Access-token authorization is session-bound and server-side role state is loaded from PostgreSQL.
- Refresh tokens are opaque random values; only SHA-256 hashes are persisted.
- Refresh-token rotation is transactional and records `replaced_by`.
- Reuse of a revoked refresh token revokes remaining active sessions for that user.
- Logout revokes the current persistent session.
- Database migrations use PostgreSQL advisory transaction locking.
- Dynamic CRUD is deny-by-default, uses a database-backed resource allow-list, protects system tables, filters sensitive columns, validates identifiers, parameterizes values, limits pagination, and audits outcomes.
- VPS gateway disables `x-powered-by`, applies baseline security headers, limits JSON body size, and rate-limits login/refresh endpoints.
- Server-side role authorization is enforced for owner/device/hardware/user-management routes.
- Secrets are represented only by placeholders in `.env.example`; local `.env` and key material are ignored.

## Required local verification

The repository changes were made without installing dependencies or running the user's database. Run these commands on the target machine after reviewing the branch:

```bash
npm install
npm run test:security
npm run db:migrate:verify
npm run db:migrate
```

Then start the appropriate runtime and perform an application-level login, refresh, logout, role-change, device-approval, and dynamic-CRUD verification.

## Important

A clean static audit cannot prove production security by itself. Database integration, reverse-proxy configuration, TLS termination, secret management, backup/restore, and the existing Electron runtime must still be verified in the target environment.
