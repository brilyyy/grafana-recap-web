---
title: Processing Logs
description: Processing log viewer and execution history.
---

## Main Code Path

- tRPC router: `src/server/trpc/routers/processingLogs.ts` (`processingLogs.list`)
- Table: `app_processing_log` (mapped via `appProcessingLog` schema)
- Superadmin UI: `src/routes/_dashboard/superadmin/processing.tsx`

## Key Schema (`app_processing_log`)

| Column | Type | Description |
|--------|------|-------------|
| `id_app_identifier` | int | App reference |
| `function_name` | varchar | Stored procedure executed |
| `status` | varchar | `success` / `failed` / `running` |
| `output` | text | Procedure output or error message |
| `created_at` | timestamp | Execution timestamp |

## Execution Flow

1. Scheduled job or manual trigger executes a stored procedure.
2. Procedure result logged to `app_processing_log` with status and output.
3. Visible on Summary page (per-app, recent entries) and Superadmin → Processing (all apps, filterable).

## Error-Prone Points

- Procedure fails but log entry not created (connection error before logging).
- Orphaned `running` entries if worker crashes mid-execution.
- High volume slows queries — index on `(id_app_identifier, created_at)` recommended.

## Query Debug SQL

```sql
SELECT id, id_app_identifier, function_name, status, output, created_at
FROM app_processing_log
WHERE id_app_identifier = 1
ORDER BY created_at DESC
LIMIT 50;
```

## Related Docs

- [Technical: Processing Scheduler](/technical/processing-scheduler)
- [Feature: Dashboard](/features/dashboard)
