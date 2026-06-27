---
title: Processing Scheduler
description: Scheduler internals.
---

## Main Code Path

- Scheduler worker (separate process, forked from server): `src/workers/scheduler-worker.ts` — reads `scheduler_jobs WHERE enabled = true`, registers one `node-cron` task per row.
- Server entry that forks/restarts worker: `src/server.ts` (`startSchedulerWorker()`, `restartSchedulerWorker()` via `globalThis.__restartScheduler`).
- Job CRUD (UI-driven, live, no redeploy): tRPC `src/server/trpc/routers/scheduler.ts` (`listJobs`/`createJob`/`updateJob`/`deleteJob`/`toggleJob`) — each mutation calls `restartSchedulerWorker()`.
- Baseline seed (for fresh install): `src/db/seed-schedules.ts` (`SEED_JOBS`, idempotent — `ON CONFLICT ("procedure") DO NOTHING`), runs automatically during `pnpm db:migrate` (cron phase) or manually via `pnpm db:seed-schedules`.
- Table `scheduler_jobs`: DDL at `src/db/sql/06_cron/scheduler_jobs.sql`.
- Manual trigger (UI, needs superadmin session): `src/lib/application/recap/trigger-recap.ts` + tRPC `recap.triggerManual`.
- Recap catalog: `src/lib/domain/recap/catalog.ts` (`buildRecapCatalog()`, built from `@meta` frontmatter of each procedure file — see [success-rate-sql](/operations/success-rate-sql)) plus ad-hoc procedures from `app_custom_procedure` table.
- Migration orchestrator: `src/db/migrate.ts`.
- `src/lib/scheduler.ts` (old `RECAP_JOBS` array) **no longer used** — do not edit for adding new jobs, see [add-new-app](/operations/add-new-app) section "Update Scheduler".

## Execution Architecture

Scheduler runs as a separate worker process (`src/workers/scheduler-worker.ts`),
forked from the main server process at startup and automatically restarted whenever jobs
are created/updated/deleted/toggled via **Superadmin → Scheduler** — no redeploy needed.

- Worker reads all `scheduler_jobs` rows where `enabled = true`, creates one `node-cron` task per row with per-job timezone (`timezone` column, fallback `Asia/Jakarta` if empty — not from env).
- Each task calls a DB stored procedure (`procedure` column) with argument `NULL::date` (H-1).
- Cron expression validated via `cron.validate()`; invalid -> job **skipped** (warning log), **no** fallback to any default.

## Scheduler Jobs — DB-driven (not Environment Variables)

No more env vars per app — all schedules live in the `schedule` column of `scheduler_jobs` table, editable via Superadmin → Scheduler or `SEED_JOBS`. `SCHEDULER_TIMEZONE` in `src/env.ts` still exists but is **not read** by the worker.

## Error-Prone Points

- Invalid cron expression -> job skipped, check `Invalid cron, skipping` warning in worker log.
- Stored procedure not yet deployed (run `pnpm db:migrate:procedures`).
- Job fails due to wrong DB connection — error caught, logged to `scheduler_jobs.lastError`/`lastStatus`, worker stays alive for other jobs.
- Worker does not restart after create/update job via UI -> check server log for `restartSchedulerWorker` / child process exiting.

## Checklist Troubleshooting

1. Check worker boot log: `Ready` (`{ pid, jobCount }`), then one `Job scheduled` line per active job (or `Invalid cron, skipping` for malformed jobs).
2. Check per-run log: `Job starting` / `Job completed` / `Job failed` (with `durationMs`).
3. Stored procedure: test manually `SELECT public.sp_process_bale_daily(NULL);`.
4. Processing results: check `app_processing_log` (also visible on Summary page and Superadmin → Processing) plus `lastStatus`/`lastRunAt` columns in `scheduler_jobs`.

## Manual Trigger

Manual recap can only be triggered via UI (Superadmin) through tRPC `recap.triggerManual`
(`superAdminProcedure`, requires session) with input `catalogEntryId` (e.g. `sr:bale`)
plus optional `date` (`YYYY-MM-DD`; without `date` = H-1). No machine-to-machine endpoint.

## Query Debug SQL

```sql
SELECT *
FROM app_processing_log
ORDER BY created_at DESC
LIMIT 30;
```

## Related Docs

- [Feature: Processing Scheduler](/features/processing-scheduler)
- [Operations: Success Rate SQL](/operations/success-rate-sql)
