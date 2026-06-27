---
title: Processing Scheduler
description: Schedule and run recurring success-rate processing jobs.
---

## Purpose

Schedule and run recurring success-rate processing jobs.

## Main Function

- Execute per-app processing procedures/functions on schedule (node-cron worker process; always on).
- Superadmin can create/edit/delete scheduler jobs live from the dashboard (no redeploy).
- Superadmin can trigger a recap manually for a specific date from the dashboard.

## Flow Summary

- Migration creates the required stored procedures and the `scheduler_jobs` table (seeded with baseline jobs).
- A dedicated worker process (forked from `src/server.ts`) reads enabled rows from `scheduler_jobs` and triggers processing per row's cron expression; it restarts automatically when jobs are created/edited/deleted via the UI.
- Processing status is tracked in `app_processing_log` and shown on the Summary page and Superadmin → Processing; per-job run status is shown on Superadmin → Scheduler.

## Config Inputs

- Job name, target procedure, cron expression, and timezone — all set per-job in Superadmin → Scheduler (DB-driven, not env vars).
- `SCHEDULER_TIMEZONE` env var exists as a fallback default but is not read by the worker.

## Related Docs

- [Technical: Processing Scheduler](/technical/processing-scheduler)
- [Operations: Success Rate SQL](/operations/success-rate-sql)
