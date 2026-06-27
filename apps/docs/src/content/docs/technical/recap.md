---
title: Recap
description: Recap catalog, trigger system, and procedure management.
---

## Main Code Path

- Recap tRPC router: `src/server/trpc/routers/recap.ts` (`recap.listCatalog`, `recap.getCatalogEntry`, `recap.triggerManual`)
- Catalog builder: `src/lib/domain/recap/catalog.ts` (`buildRecapCatalog`, `getAllCatalogEntries`, `getCatalogEntryByIdAsync`)
- Trigger: `src/lib/application/recap/trigger-recap.ts` (`triggerRecap`)
- App resolver: `src/lib/domain/recap/resolve-app.ts`
- Implementation procedures: `src/db/sql/03_procedures/` (per-app recap functions)

## Recap Catalog

The recap catalog is the central registry of all executable procedures. Built from:

1. **SQL procedure files** — each file in `src/db/sql/03_procedures/` has frontmatter comments (`@meta`) describing its app, recap kind, and schedule.
2. **Custom procedures** — entries from `app_custom_procedure` table, registered via Superadmin UI.

Each catalog entry has a unique ID (e.g. `sr:bale`, `rekap:app_name`), linked to a stored procedure function.

## Manual Trigger Flow

1. Superadmin opens **Superadmin → Recap Catalog** and selects an entry.
2. Optionally enters target date (`YYYY-MM-DD`; defaults to H-1).
3. tRPC `recap.triggerManual` calls `triggerRecap()`:
   - Validates entry exists and procedure is accessible.
   - Calls `SELECT public.{function_name}(target_date)`.
   - Logs result to `app_processing_log`.

## Error-Prone Points

- Stored procedure not deployed (run `pnpm db:migrate:procedures`).
- Catalog entry references non-existent function.
- Procedure execution timeout for large date ranges.

## Related Docs

- [Technical: App Procedures](/technical/app-procedures)
- [Technical: Processing Scheduler](/technical/processing-scheduler)
- [Operations: Add New Recap Model](/operations/add-new-recap-model)
