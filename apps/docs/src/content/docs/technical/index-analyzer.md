---
title: Index Analyzer
description: Index analyzer internals.
---

## Main Code Path

- tRPC router: `src/server/trpc/routers/indexAnalyzer.ts` (`indexAnalyzer.analyze`, `superAdminProcedure`, query only — no DDL executed).
- Source-of-truth scan: `scanSqlObjects()` in `src/db/sql-loader.ts` — regex-parse all files in `src/db/sql/{01_schema,02_indexes,03_procedures,06_cron}/` to build list of expected tables/enums/functions/indexes.
- UI: `src/routes/_dashboard/superadmin/index-analyzer.tsx`.

## `analyze` Execution Flow

Five queries run in parallel (`Promise.all`), all read-only against Postgres catalog:

1. **Unused** — `pg_stat_user_indexes` with `idx_scan = 0`, not unique/primary key. Recommendation: `DROP INDEX IF EXISTS`.
2. **Missing** — `pg_stat_user_tables` with `seq_scan > 0`, `idx_scan <= seq_scan`, `n_live_tup > 1000`. Top 50 by `seq_scan`. Recommendation: review frequently-used WHERE/JOIN columns.
3. **Sizes** — `pg_stat_user_tables` + `pg_total_relation_size`/`pg_relation_size`/`pg_indexes_size`. Top 50 by total size. `deadPct = n_dead_tup / n_live_tup`; `VACUUM (ANALYZE)` recommended when `deadPct >= 20`.
4. **Redundant** — fetch all indexes + ordered column list (`indexColumns()`), then `findRedundant()`: non-unique index is redundant if its column list is a leading prefix of another index on the same table.
5. **Drift** — compare `pg_indexes` (live) vs `scanSqlObjects().indexes` (expected from `src/db/sql/02_indexes`):
   - Expected but not in DB -> status `missing` (re-run Schema phase).
   - In DB but not in source, and not a constraint index (`_pkey`, `_key`, `_grain_key`, `unique_dictionary_entry`) -> status `extra` (informational — add to source or drop).

Response wrapped into a single `IndexAnalyzerReport` (`unused`, `missing`, `sizes`, `redundant`, `drift`, `summary` counts, `dbName`).

## Error-Prone Points

- `dbName` read from `process.env.DB_NAME` — empty/"unknown" if env not set, does not affect analysis results.
- `scanSqlObjects()` regex depends on standard SQL formatting — indexes created via non-standard syntax won't be detected as "expected", potentially appearing as drift `extra`.
- All recommendations are **SQL text for manual copying** — analyzer never executes `DROP`/`VACUUM` itself.

## Checklist Troubleshooting

1. Blank page/error -> check `query.error.message` (usually DB connection or `pg_stat_*` permissions).
2. Index appears in "drift: extra" but already in source -> check if index file exists in `src/db/sql/02_indexes/` and name matches exactly (case-sensitive after lower-case regex).
3. "Missing" / "Unused" not updating after manual `VACUUM`/`DROP` -> click **Rerun**, `pg_stat_*` statistics need refresh by planner/autovacuum.

## Query Debug SQL

```sql
SELECT relname, idx_scan, pg_size_pretty(pg_relation_size(indexrelid))
FROM pg_stat_user_indexes
WHERE schemaname = 'public' AND idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;
```

## Related Docs

- [Feature: Index Analyzer](/features/index-analyzer)
- [Operations: Success Rate SQL](/operations/success-rate-sql)
