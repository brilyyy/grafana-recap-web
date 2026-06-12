# Server Configuration Guide

This document describes how to configure the PostgreSQL server for the Dashboard Grafana platform.

> **Note:** pg_cron has been removed — recap jobs run in the application via the
> node-cron scheduler (`src/lib/scheduler.ts`), started automatically from `src/server.ts`.
> No `shared_preload_libraries` or cron extension configuration is needed anymore.

## PostgreSQL Requirements

- PostgreSQL with the `postgres_fdw` extension available (used to read raw
  transaction tables from source databases — see `pnpm db:migrate:fdw`).
- The stored procedures deployed by `pnpm db:migrate:procedures`
  (`sp_process_*_daily`, `sp_recap_*_daily`).
- Timezone handling is done by the app scheduler (`SCHEDULER_TIMEZONE`,
  default `Asia/Jakarta`); the database can stay on UTC.

## Application Environment

The app validates its environment at startup (`src/env.ts`). Minimum required:

```env
DB_HOST=your-db-host
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=...
DB_NAME=platform_db

BETTER_AUTH_SECRET=...           # long random string
BETTER_AUTH_URL=https://your-host # https enables secure cookies automatically
```

Optional scheduler overrides (cron format, default `1 0 * * *`):

```env
SCHEDULER_TIMEZONE=Asia/Jakarta
BALE_PROCESSING_SCHEDULE=1 0 * * *
BALE_BISNIS_PROCESSING_SCHEDULE=1 0 * * *
OLOB_PROCESSING_SCHEDULE=1 0 * * *
CMS_PROCESSING_SCHEDULE=1 0 * * *
BALE_KORPORA_PROCESSING_SCHEDULE=1 0 * * *
CMS_CORP_RECAP_SCHEDULE=1 0 * * *
BALE_KORPORA_CORP_RECAP_SCHEDULE=1 0 * * *
```

## FDW (postgres_fdw)

Source databases/tables are registered in `fdw_source_table` (managed from
Superadmin → App config). After changing them, run:

```bash
pnpm db:migrate:fdw
```

## Verify

1. App startup log shows `Initializing scheduler...` and one
   `✅ <job> scheduler configured` line per recap job.
2. `SELECT public.sp_process_bale_daily(NULL);` runs without error.
3. Processing results land in `app_processing_log` (visible on the Summary page).

## Related Docs
- [Technical Index](README.md)
- [Processing Scheduler Technical Notes](processing-scheduler.md)
- [Project README](../../README.md)
