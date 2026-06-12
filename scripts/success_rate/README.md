# Success Rate SQL and Procedure Docs

This directory stores SQL assets for success-rate aggregation and processing procedures.

## Purpose
- Keep procedure and raw query SQL close to runtime loaders.
- Provide one local reference for SQL naming and execution flow.

## Directory Convention
- `scripts/success_rate/registry.ts`: app-to-procedure registry.
- `scripts/success_rate/runProcedures.ts`: procedure loader/executor.
- `scripts/success_rate/{app}/raw.postgres.sql`: PostgreSQL raw aggregation query.
- `scripts/success_rate/{app}/procedure.postgres.sql`: PostgreSQL stored function/procedure definition.

## Workflow
1. Add or update SQL files per app.
2. Register app metadata in `registry.ts`.
3. Run migration phase for procedures.
4. Verify scheduler and processing logs.

## Deep Technical References
- [Processing Scheduler Technical Notes](../../docs/technical/processing-scheduler.md)
- [Success Rate Upload Technical Notes](../../docs/technical/success-rate-upload.md)

## Related Docs
- [Project README](../../README.md)
- [Documentation Hub](../../docs/README.md)
- [Feature: Success Rate Upload](../../docs/features/success-rate-upload.md)
- [Feature: Processing Scheduler](../../docs/features/processing-scheduler.md)
- [Technical Docs Index](../../docs/technical/README.md)
