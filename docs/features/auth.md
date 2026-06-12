# Authentication

## Purpose
Provide secure login and session validation for protected routes.

## Main Function
- Username/password login via BetterAuth (username plugin, argon2 hashing).
- Session check for authenticated access (tRPC `auth.check`).
- Role-aware access control (`user` / `admin` / `superadmin`) enforced in tRPC middleware.
- First registration creates the initial admin; later registrations queue as pending requests for superadmin approval.

## Flow Summary
- Client calls `authClient.signIn.username(...)` → BetterAuth validates against `users` + `account` tables.
- BetterAuth issues a session cookie (secure cookies auto-enabled when `BETTER_AUTH_URL` is https).
- Protected pages use the `useAuthSession` hook; server code uses `requireAuth` / `requireRole`.

## APIs
- `/api/auth/*` — BetterAuth handler (sign-in, sign-out, session)
- tRPC `auth.check`, `auth.checkAdmin`, `auth.createAdmin`, `auth.submitUserRequest`, `auth.approveRequest`, `auth.rejectRequest`

## Related Docs
- [Feature Index](README.md)
- [Technical Auth Notes](../technical/auth.md)
- [Project README](../../README.md)
