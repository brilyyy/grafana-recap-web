# Processing Scheduler

## Purpose
Schedule and run recurring success-rate processing jobs.

## Main Function
- Execute per-app processing procedures/functions on schedule.
- Support application-level scheduler and database scheduler modes.

## Flow Summary
- Migration creates required procedures and optional scheduler jobs.
- Runtime scheduler triggers processing per configured cron expression.
- Processing status is tracked in processing log tables.

## Config Inputs
- `BALE_PROCESSING_SCHEDULE`
- `BALE_BISNIS_PROCESSING_SCHEDULE`
- `USE_APP_LEVEL_SCHEDULER`

## Related Docs
- [Feature Index](README.md)
- [Technical Scheduler Notes](../technical/processing-scheduler.md)
- [Migration Kit README](../../migration-kit/README.md)
- [Success Rate SQL README](../../scripts/success_rate/README.md)
- [Project README](../../README.md)
