# Adding a new custom daily recap model

PostgreSQL only.

## 1. Decide grain and output table

- If the result is not `app_success_rate`, add a **new table** in [src/db/sql/01_schema/40_recap_models.sql](../../src/db/sql/01_schema/40_recap_models.sql) (see `recap_cms_corp_daily` / `recap_bale_korpora_corp_daily` for the pattern) with the columns, unique grain constraint, and `updated_at` trigger you need.
- Use a clear name: `recap_{app}_{model}_daily` or similar.

## 2. SQL assets

One file, no folder, under [src/db/sql/03_procedures/recap_models/](../../src/db/sql/03_procedures/recap_models/):

```
src/db/sql/03_procedures/recap_models/{recap_kind}.sql   # CREATE OR REPLACE FUNCTION public.sp_recap_... + @meta block
src/db/sql/reference/recap_models/{recap_kind}.raw.sql   # Representative SELECT for documentation / Superadmin brief query (not auto-run)
```

- Function signature: `public.sp_recap_<name>_daily(p_processing_date DATE DEFAULT NULL)`
  - `NULL` argument → process **H-1** (`CURRENT_DATE - 1 day`).
  - Explicit date → that calendar day.
- Write `DELETE` for this model's target table for `(id_app_identifier, tanggal_transaksi)` then `INSERT` aggregated rows.
- Insert into `app_processing_log` with **`recap_kind`** set to your stable kind string (e.g. `cms_corp_daily`), not only default `success_rate_daily`.
- Prefix the file with a `/* @meta ... @endmeta */` block (see `cms_corp_daily.sql` for a full example):
  ```sql
  /* @meta
  id: cms_corp_daily
  recap_kind: cms_corp_daily
  title: {App} — daily recap by {dimension}
  output_table: recap_{app}_{model}_daily
  function_name: sp_recap_{name}_daily
  scope_type: fixed_app
  app_key: {app_key}
  raw_sql_repo_path: src/db/sql/reference/recap_models/{recap_kind}.raw.sql
  description: ...
  @endmeta */
  ```

## 3. Catalog — nothing to register

There is no registry and no runner script. `parseSqlMeta()` in [src/db/sql-loader.ts](../../src/db/sql-loader.ts) reads the `@meta` block at migration time, and `buildRecapCatalog()` in [src/lib/domain/recap/catalog.ts](../../src/lib/domain/recap/catalog.ts) (`loadProcedureMetas('recap_models')`) picks it up automatically for the UI/API. The `.sql` file alone is the source of truth.

## 4. Scheduler

Scheduling is DB-driven via the `scheduler_jobs` table, executed by [src/workers/scheduler-worker.ts](../../src/workers/scheduler-worker.ts) — no env vars, no `src/lib/scheduler.ts` (unused).

- **Live, no redeploy:** Superadmin → Scheduler → Add Job, with `procedure` set to your `function_name`.
- **Permanent, seeded on fresh installs:** add an entry to `SEED_JOBS` in [src/db/seed-schedules.ts](../../src/db/seed-schedules.ts) (`name`, `procedure`, `defaultSchedule`).

## 5. Verify

- `npm run db:migrate` (or your DB_NAME/DB_TYPE targets).
- Superadmin → **Daily recaps**: new row appears; **Run now** triggers the function.
- Superadmin → **Application Data Processing**: set **Recap kind** to your `recap_kind` to view logs on the calendar.
