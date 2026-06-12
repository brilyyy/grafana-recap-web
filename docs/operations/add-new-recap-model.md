# Adding a new custom daily recap model

PostgreSQL only.

## 1. Decide grain and output table

- If the result is not `app_success_rate`, add a **new table** in [src/db/migrate.ts](../../src/db/migrate.ts) (e.g. Phase 3b) with the columns you need and indexes.
- Use a clear name: `recap_{app}_{model}_daily` or similar.

## 2. SQL assets

Create a folder under [scripts/recap_models/](../../scripts/recap_models/):

```
scripts/recap_models/{modelKey}/
  procedure.postgres.sql   # CREATE OR REPLACE FUNCTION public.sp_recap_...
  raw.postgres.sql        # Representative SELECT for documentation / Superadmin brief query
```

- Function signature: `public.sp_recap_<name>_daily(p_processing_date DATE DEFAULT NULL)`
  - `NULL` argument → process **H-1** (`CURRENT_DATE - 1 day`).
  - Explicit date → that calendar day.
- Write `DELETE` for this model’s target table for `(id_app_identifier, tanggal_transaksi)` then `INSERT` aggregated rows.
- Insert into `app_processing_log` with **`recap_kind`** set to your stable kind string (e.g. `cms_corp_daily`), not only default `success_rate_daily`.

## 3. Registry (migration)

Add an entry to [scripts/recap_models/registry.ts](../../scripts/recap_models/registry.ts):

- `modelKey`, `functionName`, `scheduleEnvVar` (cron env var for the app-level node-cron scheduler).

Migration runs [scripts/recap_models/runProcedures.ts](../../scripts/recap_models/runProcedures.ts) via Phase 5b in `migrate.ts`.

## 4. Catalog (UI + API)

Extend [src/domain/recap/catalog.ts](../../src/domain/recap/catalog.ts) `customRecapEntries()`:

- `id`, `recapKind`, `title`, `description`, `briefProcessSummary`, `briefQuery`, `outputTable`, `functionName`, `scheduleEnvVar`, `rawSqlRepoPath`, `scope`.

## 5. Scheduler

- **App-level:** [src/lib/scheduler.ts](../../src/lib/scheduler.ts) — add one entry to the `RECAP_JOBS` table (`name`, `envVar`, `procedure`).
- **Env:** add default in [src/env.ts](../../src/env.ts) and document in `.env.example` if present.

## 6. Verify

- `npm run db:migrate` (or your DB_NAME/DB_TYPE targets).
- Superadmin → **Daily recaps**: new row appears; **Run now** triggers the function.
- Superadmin → **Application Data Processing**: set **Recap kind** to your `recap_kind` to view logs on the calendar.
