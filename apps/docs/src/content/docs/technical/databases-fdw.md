---
title: Databases & FDW
description: Foreign Data Wrapper management for cross-database queries.
---

## Main Code Path

- Databases tRPC router: `src/server/trpc/routers/databases.ts` (`databases.list`)
- FDW tRPC router: `src/server/trpc/routers/fdw.ts` (`fdw.list`, `fdw.apply`)
- FDW setup utility: `src/lib/fdw-setup.ts` (`applyFdwConfig`)
- Client: `src/lib/fdw-client.ts`

## Execution Flow

1. **Database List** — scans Postgres catalog (`pg_database`) to show available databases, flagging those with FDW servers and source tables.
2. **FDW Apply** — for a selected database + table mapping, creates/updates foreign server, user mapping, and foreign table definitions pointing to the source database.
3. Source data becomes accessible via FDW for processing pipelines.

## Key Concepts

- **Foreign Data Wrapper** (`postgres_fdw`): Postgres extension to query remote databases.
- **Foreign table**: local table definition that maps to a remote table.
- One FDW server per remote database; one foreign table per source table.

## Error-Prone Points

- Source database unreachable (network/firewall).
- Table schema mismatch between source and definition.
- Missing `postgres_fdw` extension on target database.

## Related Docs

- [Feature: App Management](/features/app-management)
- [Operations: Server Installation](/operations/server-installation)
