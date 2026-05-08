# Authentication Technical Notes

## Code Path Utama
- Login endpoint: `src/app/api/auth/login/route.ts`
- Session check endpoint: `src/app/api/auth/check/route.ts`
- Global API middleware + rate limit: `src/middleware.ts`
- Auth helpers: `src/lib/auth` dan `src/lib/better-auth`
- Audit logging: `src/lib/audit`

## Alur Eksekusi (Code-Level)
1. `POST /api/auth/login` memanggil `enforceRateLimit(request, RATE_LIMITS.AUTH)`.
2. Username dicari dulu ke tabel `users` lalu login dilakukan via `auth.api.signInEmail(...)` (email-based).
3. Jika password salah / user tidak ditemukan:
   - response `401`
   - audit event `LOGIN_FAILED`.
4. Jika sukses:
   - BetterAuth membuat session cookie
   - response user payload
   - audit event `LOGIN_SUCCESS`.
5. `GET /api/auth/check` memanggil `getSession(request)`:
   - jika null => `authenticated: false`
   - jika ada => return `id`, `username`, `role`.

## Titik Rawan Error
- Username valid tapi email di `users` tidak sinkron -> login gagal walau password benar.
- Cookie/session tidak terkirim (proxy/https config) -> `auth/check` selalu `Not authenticated`.
- Rate limit 429 dari middleware terlihat seperti auth failure.
- `middleware.ts` punya rule limit berdasarkan pathname; pastikan endpoint benar.

## Checklist Troubleshooting
1. Test login:
   - `POST /api/auth/login` dengan username/password valid.
2. Jika gagal, cek:
   - log server: `Login error:` / `Invalid username or password`
   - tabel `users` untuk pasangan `username` + `email`.
3. Jika login sukses tapi langsung logout:
   - cek response headers cookie
   - cek env terkait cookie/secure/https
   - test `GET /api/auth/check`.
4. Jika sering 429:
   - lihat headers `X-RateLimit-*` dari middleware.

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
