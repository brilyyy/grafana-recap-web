# Processing Scheduler

## Purpose
Schedule and run recurring success-rate processing jobs.

## Main Function
- Execute per-app processing procedures/functions on schedule (app-level node-cron; always on).
- Superadmin can trigger a recap manually for a specific date from the dashboard.

## Flow Summary
- Migration creates the required stored procedures.
- The runtime scheduler (started from `src/server.ts`) triggers processing per configured cron expression.
- Processing status is tracked in `app_processing_log` and shown on the Summary page and Superadmin → Processing.

## Config Inputs
- `SCHEDULER_TIMEZONE` (default `Asia/Jakarta`)
- `*_PROCESSING_SCHEDULE` / `*_CORP_RECAP_SCHEDULE` cron expressions (default `1 0 * * *`)

## Related Docs
- [Feature Index](README.md)
- [Technical Scheduler Notes](../technical/processing-scheduler.md)
- [Success Rate SQL README](../../scripts/success_rate/README.md)
- [Project README](../../README.md)
