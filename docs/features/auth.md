# Authentication

## Purpose
Provide secure login and session validation for protected routes.

## Main Function
- User login with username and password.
- Session check for authenticated access.
- Role-aware access control across API routes.

## Flow Summary
- Validate credentials.
- Issue JWT-based session cookie.
- Enforce middleware checks for protected API routes.

## APIs
- `/api/auth/login`
- `/api/auth/check`

## Related Docs
- [Feature Index](README.md)
- [Technical Auth Notes](../technical/auth.md)
- [Project README](../../README.md)
