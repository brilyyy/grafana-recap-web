---
title: Housekeeping
description: Data retention and cleanup policies.
---

## Main Code Path

- tRPC router: `src/server/trpc/routers/housekeeping.ts` (`housekeeping.getConfig`, `housekeeping.updateConfig`, `housekeeping.runCleanup`, `housekeeping.getHistory`)
- Table columns: `app_identifier.retention_days`, `housekeeping_config`, `housekeeping_log`

## Execution Flow

1. Superadmin configures retention policy per app or globally:
   - Date column type: `timestamp` or `int_1yymmdd`
   - Date column name
   - Table name pattern
   - Retention period in days
2. Superadmin can trigger manual cleanup run.
3. Cleanup deletes records older than retention period from specified tables.
4. Execution logged to `housekeeping_log` for audit.

## Config Fields

| Field | Description |
|-------|-------------|
| `db_name` | Target database name |
| `table_name` | Table to clean |
| `date_column` | Column holding date value |
| `date_type` | `timestamp` or `int_1yymmdd` (integer YYMMDD format) |
| `retention_days` | Data retention period |
| `keep_last` | Always keep last N records regardless of age |

## Error-Prone Points

- Wrong `date_type` causes SQL errors or silent data loss (integer YYMMDD misread as timestamp).
- `table_name` does not exist in target DB.
- Transaction too large for tables with millions of rows — batch delete recommended.

## Related Docs

- [Operations: Server Installation](/operations/server-installation)
