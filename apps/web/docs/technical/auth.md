# Authentication Technical Notes

## Code Path Utama
- BetterAuth config: `src/lib/better-auth.ts` (username plugin, admin plugin, argon2 hashing, rate limits, audit hooks)
- BetterAuth route handler: `src/routes/api/auth/$.ts` (`/api/auth/*`)
- Session helpers: `src/lib/auth.ts` (`getSession`, `requireAuth`, `requireRole`, `requireSuperAdmin`)
- tRPC context + role middleware: `src/server/trpc/init.ts`
- Auth router (check/register/approval): `src/server/trpc/routers/auth.ts`
- Client session hook: `src/hooks/use-auth-session.ts` (`trpc.auth.check`)
- Rate limiting middleware: `src/start.ts` + `src/lib/rateLimit.ts`
- Audit logging: `src/lib/audit.ts`

## Alur Eksekusi (Code-Level)
1. Login page (`src/routes/login.tsx`) memanggil `authClient.signIn.username({ username, password })`.
2. BetterAuth memverifikasi credential terhadap tabel `users` (via drizzle adapter) dan `account.password` (argon2).
3. Gagal → response 401 dan hook `hooks.after` mencatat audit `LOGIN_FAILED`.
4. Sukses → session cookie dibuat; databaseHook `session.create.after` mencatat `LOGIN_SUCCESS`.
5. Setelah login/logout, client meng-invalidate cache `trpc.auth.check` sebelum navigasi (hindari redirect bounce).
6. Server-side guard: tRPC `protectedProcedure` / `superAdminProcedure`; API upload routes pakai `requireAuth(request)`.

## Titik Rawan Error
- Cookie/session tidak terkirim (proxy/https config) → `auth.check` selalu `authenticated: false`.
- Secure cookies di-derive dari `BETTER_AUTH_URL` (`https` prefix) — URL salah bikin cookie ditolak browser.
- Rate limit 429 dari middleware terlihat seperti auth failure (cek headers `X-RateLimit-*`).
- Login pakai username (bukan email) — pastikan kolom `username` terisi.

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
- [Technical Index](README.md)
- [Feature: Authentication](../features/auth.md)
- [Project README](../../README.md)
