/**
 * Global test setup — runs before every test file.
 *
 * Populates required env vars so `src/env.ts` (zod validation) doesn't
 * throw when modules importing `@/env` are loaded.  Override individual
 * vars inside a test with `process.env.X = ...` and restore in afterEach.
 */

process.env.DB_HOST = process.env.DB_HOST ?? 'localhost'
process.env.DB_PORT = process.env.DB_PORT ?? '5432'
process.env.DB_USER = process.env.DB_USER ?? 'test_user'
process.env.DB_PASSWORD = process.env.DB_PASSWORD ?? 'test_password'
process.env.DB_NAME = process.env.DB_NAME ?? 'test_db'
process.env.BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET ?? 'test-secret-at-least-32-chars-long!!'
process.env.BETTER_AUTH_URL = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'
process.env.RECAP_TRIGGER_API_KEY = process.env.RECAP_TRIGGER_API_KEY ?? 'test-api-key'
