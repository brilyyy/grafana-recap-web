---
title: Auth
description: Authentication implementation details.
---

## Main Code Path

- BetterAuth config: `src/lib/better-auth.ts` (username plugin, admin plugin, argon2 hashing, rate limits, audit hooks)
- BetterAuth route handler: `src/routes/api/auth/$.ts` (`/api/auth/*`)
- Session helpers: `src/lib/auth.ts` (`getSession`, `requireAuth`, `requireRole`, `requireSuperAdmin`)
- tRPC context + role middleware: `src/server/trpc/init.ts`
- Auth router (check/register/approval): `src/server/trpc/routers/auth.ts`
- Client session hook: `src/hooks/use-auth-session.ts` (`trpc.auth.check`)
- Rate limiting middleware: `src/start.ts` + `src/lib/rateLimit.ts`
- Audit logging: `src/lib/audit.ts`

## Execution Flow (Code-Level)

1. Login page (`src/routes/login.tsx`) calls `authClient.signIn.username({ username, password })`.
2. BetterAuth verifies credentials against `users` table (via drizzle adapter) and `account.password` (argon2).
3. Fail -> 401 response, hook `hooks.after` logs audit `LOGIN_FAILED`.
4. Success -> session cookie created; databaseHook `session.create.after` logs `LOGIN_SUCCESS`.
5. After login/logout, client invalidates `trpc.auth.check` cache before navigation (avoids redirect bounce).
6. Server-side guard: tRPC `protectedProcedure` / `superAdminProcedure`; API upload routes use `requireAuth(request)`.

## Error-Prone Points

- Cookie/session not sent (proxy/https config) -> `auth.check` always returns `authenticated: false`.
- Secure cookies derived from `BETTER_AUTH_URL` (`https` prefix) — wrong URL causes browser to reject cookies.
- Rate limit 429 from middleware looks like auth failure (check headers `X-RateLimit-*`).
- Login uses username (not email) — ensure `username` column is populated.

## Query Debug SQL

```sql
SELECT id, username, email, role FROM users WHERE username = 'your_username';
SELECT id, username, action, created_at
FROM audit_logs
WHERE action IN ('LOGIN_SUCCESS', 'LOGIN_FAILED')
ORDER BY created_at DESC
LIMIT 20;
```

## Related Docs

- [Feature: Auth](/features/auth)
