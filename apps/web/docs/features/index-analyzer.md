# Index Analyzer

## Purpose
Read-only Postgres health check for superadmins — surfaces unused indexes, tables
that lean on sequential scans, table/index size and bloat, redundant (prefix-covered)
indexes, and drift between the live DB and the `src/db/sql/` source of truth.

## Main Function
- Run a full analysis on demand (Superadmin → Index Analyzer → **Rerun**).
- Five report sections: Unused Indexes, Missing Indexes (seq-scan heavy tables),
  Table & Index Sizes (with dead-tuple %), Redundant Indexes, and Schema Drift.
- Every finding ships a copyable SQL recommendation (click to copy) — `DROP INDEX`,
  `VACUUM (ANALYZE)`, or a pointer to re-run the schema migration.

## Flow Summary
- Superadmin opens the page; a tRPC query runs five read-only `pg_stat_*` / `pg_index`
  queries against the connected DB and diffs live indexes against `scanSqlObjects()`
  (parsed from `src/db/sql/`).
- Nothing is executed automatically — the analyzer never issues DDL itself.

## APIs
- tRPC `indexAnalyzer.analyze` (`superAdminProcedure`, query only).

## Related Docs
- [Feature Index](README.md)
- [Technical Index Analyzer Notes](../technical/index-analyzer.md)
- [Project README](../../README.md)
