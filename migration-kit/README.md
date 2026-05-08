# Migration Kit

This folder contains a standalone migration runner for production environments.

## Purpose
- Run database migration without deploying the full Next.js runtime.
- Support controlled migration execution on production servers.

## Core Steps
1. Copy `migration-kit` to target server.
2. Create `.env` from `.env.example`.
3. Install dependencies (`npm ci`) or copy prebuilt `node_modules` for offline server.
4. Run migration: `npm run migrate`.

## Important Notes
- PostgreSQL is the active path for new work.
- Keep `migration-kit/src/db/migrate.ts` and `migration-kit/scripts/success_rate/*` synced from the main project when migration logic changes.
- Use `npm run migrate:fdw` when only FDW setup is required.

## Common Commands
- Full migration: `npm run migrate`
- Schema only: `npm run migrate:schema`
- Procedures only: `npm run migrate:procedures`
- Scheduler only: `npm run migrate:cron`
- Seed only: `npm run migrate:seed`
- FDW only: `npm run migrate:fdw`

## Related Docs
- [Project README](../README.md)
- [Documentation Hub](../docs/README.md)
- [Technical Scheduler Notes](../docs/technical/processing-scheduler.md)
- [Success Rate SQL README](../scripts/success_rate/README.md)
- [Deploy Pointer README](../deploy/deploynew/migration-kit/README.md)
