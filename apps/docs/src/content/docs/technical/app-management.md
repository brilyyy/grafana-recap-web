---
title: App Management
description: Application management implementation details.
---

## Main Code Path

- tRPC router: `src/server/trpc/routers/applications.ts` (`applications.list`/`create`/`updateConfig`)
- Migration schema table: `src/db/migrate.ts` (Phase 1: `app_identifier`)

## Key `app_identifier` Columns

- `app_name`: unique application name.
- `db_name`: raw source database name (for FDW/cross-db).
- `raw_table_name`: main raw table name.

## Execution Flow (tRPC `applications.create`)

1. Validate `appName`.
2. Auto-generate:
   - `db_name = {normalized}_db`
   - `raw_table_name = raw_{normalized}`.
3. Insert into `app_identifier`.
4. Handle duplicate key: PostgreSQL `23505`.

## Error-Prone Points

- `appName` empty -> `400`.
- Duplicate app name -> `400 Application name already exists`.
- Incomplete app config (`db_name`/`raw_table_name`) causes FDW/processing failure.

## Checklist Troubleshooting

1. Check app list (tRPC `applications.list`).
2. Check app config data (`db_name`, `raw_table_name`).
3. If upload/processing fails for a specific app:
   - verify `id_app_identifier` is valid
   - verify app mapping config in DB.

## Query Debug SQL

```sql
SELECT id, app_name, db_name, raw_table_name, retention_days
FROM app_identifier
ORDER BY app_name;
```

## Related Docs

- [Feature: App Management](/features/app-management)
