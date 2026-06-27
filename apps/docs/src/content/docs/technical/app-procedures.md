---
title: App Procedures
description: Custom stored procedures for per-app processing.
---

## Main Code Path

- tRPC router: `src/server/trpc/routers/appProcedures.ts` (`appProcedures.listForApp`, `appProcedures.listAll`, `appProcedures.create`, `appProcedures.update`, `appProcedures.delete`)
- Table: `app_custom_procedure`

## Key Schema (`app_custom_procedure`)

| Column | Type | Description |
|--------|------|-------------|
| `id_app_identifier` | int FK | References `app_identifier` |
| `function_name` | varchar | Stored procedure name (format: `sp_[a-z0-9_]{2,55}`) |
| `recap_kind` | varchar | Recap type identifier (e.g. `sr`, `rekap`) |
| `output_table` | varchar | Target table for processing output |
| `schedule_cron` | varchar | Optional cron schedule override |
| `description` | text | Human-readable purpose |

## Execution Flow

1. Superadmin registers a custom procedure for an app, specifying function name and recap kind.
2. Procedure is included in the recap catalog under its app.
3. Scheduler can trigger it via `scheduler_jobs` (if scheduled).
4. Manual trigger via Superadmin → Recap Catalog → select procedure + date.

## Validation Rules

- `function_name` must match `sp_[a-z0-9_]{2,55}` regex.
- Procedure must exist in DB before registration (verified on trigger, not on create).
- App must exist (`id_app_identifier` foreign key).

## Related Docs

- [Technical: Recap](/technical/recap)
- [Operations: Add New App](/operations/add-new-app)
