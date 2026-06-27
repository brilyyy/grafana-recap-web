---
title: Success Rate SQL
description: SQL assets for success-rate aggregation and processing procedures.
---

This directory stores SQL assets for success-rate aggregation and processing procedures.

## Purpose

- Keep procedure and raw query SQL close to runtime loaders.
- Provide one local reference for SQL naming and execution flow.

## Directory Convention

No registry, no runner script — one `.sql` file per app is the source of truth:

- `src/db/sql/03_procedures/success_rate/{app_key}.sql`: PostgreSQL stored function, prefixed with a `/* @meta ... @endmeta */` frontmatter block (`id`, `recap_kind`, `title`, `output_table`, `function_name`, `scope_type`, `app_key`, `raw_sql_repo_path`, `description`).
- `src/db/sql/reference/success_rate/{app_key}.raw.sql`: PostgreSQL raw aggregation query — referenced by `raw_sql_repo_path`, not auto-executed; for documentation / Superadmin brief query only.

`src/db/sql-loader.ts`'s `parseSqlMeta()` reads the `@meta` block at migration time and feeds `buildRecapCatalog()` in `src/lib/domain/recap/catalog.ts` — adding the `.sql` file is the only registration step needed.

## Workflow

1. Add or update the `.sql` file (+ optional `.raw.sql` reference) per app.
2. Run the migration procedures phase (`pnpm db:migrate:procedures` or full `pnpm db:migrate`) — the `@meta` block is picked up automatically.
3. Verify scheduler and processing logs.

## Related Docs

- [Technical: Processing Scheduler](/technical/processing-scheduler)
- [Technical: Success Rate Upload](/technical/success-rate-upload)
- [Feature: Success Rate Upload](/features/success-rate-upload)
- [Feature: Processing Scheduler](/features/processing-scheduler)
