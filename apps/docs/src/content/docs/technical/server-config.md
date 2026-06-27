---
title: Server Config
description: Server configuration guide.
---

> **Note:** pg_cron has been removed — recap jobs run via a node-cron-based worker
> process (`src/workers/scheduler-worker.ts`), forked automatically from `src/server.ts`
> and driven by the `scheduler_jobs` DB table. No `shared_preload_libraries` or cron
> extension configuration is needed anymore.

## PostgreSQL Requirements

- PostgreSQL with the `postgres_fdw` extension available (used to read raw
  transaction tables from source databases — see `pnpm db:migrate:fdw`).
- The stored procedures deployed by `pnpm db:migrate:procedures`
  (`sp_process_*_daily`, `sp_recap_*_daily`).
- Timezone handling is per-job in the `scheduler_jobs` table (`timezone` column,
  fallback `Asia/Jakarta`); `SCHEDULER_TIMEZONE` exists in `src/env.ts` but isn't
  read by the worker. The database can stay on UTC.

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

Scheduler jobs are **not** configured via env vars — they live in the `scheduler_jobs`
DB table, either created live via Superadmin → Scheduler or seeded from `SEED_JOBS`
in `src/db/seed-schedules.ts` on a fresh install. See
[Processing Scheduler](/technical/processing-scheduler).

## FDW (postgres_fdw)

Source databases/tables are registered in `fdw_source_table` (managed from
Superadmin → App config). After changing them, run:

```bash
pnpm db:migrate:fdw
```

## Verify

1. Worker startup log shows `Ready` (`{ pid, jobCount }`) and one `Job scheduled`
   line per enabled job (see [Processing Scheduler](/technical/processing-scheduler)).
2. `SELECT public.sp_process_bale_daily(NULL);` runs without error.
3. Processing results land in `app_processing_log` (visible on the Summary page).

## Related Docs

- [Processing Scheduler](/technical/processing-scheduler)
