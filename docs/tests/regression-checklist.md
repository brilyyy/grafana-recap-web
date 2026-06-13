# Manual Regression Checklist

Covers two migration layers:

**Framework migration (phases 1–6)**
- Next.js → TanStack Start + React 19 + Vite
- REST `fetch()` → tRPC
- MySQL → PostgreSQL-only (`pg`, `postgres_fdw`)
- Raw SQL → Drizzle (split schema)
- Auth → better-auth + argon2
- Tailwind v4 + shadcn, Biome
- Custom env validator

**Scheduler + FDW rework (recent)**
- Database-driven cron jobs in `scheduler_jobs` table (replaced env-var/`pg_cron`)
- Isolated forked worker (`src/workers/scheduler-worker.ts`) driven over IPC by `src/server.ts`
- FDW auto-apply on every `fdw.add/remove/applyFdw` mutation (replaced manual `db:migrate`)
- Processing page: calendar → selectable batch table
- Dictionary absorbed unmapped-RC panel; in-app `/docs` reader added

**Risk levels:** `High` = data loss / silent wrong data / outage. `Medium` = degraded UX / recoverable. `Low` = cosmetic.

> **Three hazards surfaced during analysis:**
> 1. `src/lib/scheduler.ts` (`initializeScheduler`) is now dead code — confirm nothing re-wires it (see S1).
> 2. `processing.tsx:140` — `today.toISOString()` shifts UTC+7 local midnight back a day in ISO string; "today" badge and processable cutoff may be off by one (see P1).
> 3. `applyFdwConfig` uses a global `_fdw_import_tmp` schema — two concurrent applies can collide (see F4).

---

## 1 · Scheduler Worker — process lifecycle

`src/server.ts`, `src/workers/scheduler-worker.ts`

| ID | Test Scenario | Prerequisites / Setup | Expected Result | Risk |
|----|---------------|-----------------------|-----------------|------|
| S1 | Only ONE scheduler runs — old in-process scheduler never starts | Grep compiled output for `initializeScheduler` calls; start app, watch logs | Only `[scheduler-worker]` boot lines appear. No job fires twice in the same minute | High |
| S2 | Worker boots in **dev** (tsx) | `pnpm dev`, `scheduler_jobs` has ≥1 enabled job | Worker forked via `node_modules/.bin/tsx`, logs `Ready (pid=…, N jobs)` | High |
| S3 | Worker boots in **prod** (compiled .mjs) | `pnpm build && pnpm start` | `IS_COMPILED` path resolves `dist/server/workers/scheduler-worker.mjs`; boot logged | High |
| S4 | Crash → auto-restart with backoff | Kill worker PID (non-zero exit) | Parent restarts after `2000 * attempt` ms; up to 5 attempts; `restartAttempts` resets to 0 on next `ready` | High |
| S5 | Restart cap reached | Force worker to exit non-zero 6× quickly | After 5 attempts parent stops restarting; HTTP still serves; absence of scheduler logged, not crashed | High |
| S6 | Clean exit (code 0) does NOT restart | Send SIGTERM to worker | Worker stops all tasks, ends pool, exits 0; parent does **not** spawn a replacement | Medium |
| S7 | Graceful shutdown drains connections | SIGTERM/SIGINT during idle window | `stopAll()` runs, `pool.end()` completes; no orphaned PG connections | Medium |
| S8 | Single-fork guard on HMR / re-import | Trigger HMR / re-import of `server.ts` in dev | `__schedulerStarted` prevents second fork; exactly one worker PID | High |
| S9 | Worker DB env fallback correctness | Start worker with `DB_PASSWORD` unset | Worker fails loudly rather than silently connecting to wrong DB with empty password | High |
| S10 | `workerStatus` reflects reality | Open Scheduler page; kill worker | UI badge flips `PID n` → `Disconnected` within 10s `refetchInterval` | Medium |

---

## 2 · Scheduler Jobs — DB-driven CRUD ↔ worker sync

`src/server/trpc/routers/scheduler.ts`, `src/routes/_dashboard/superadmin/scheduler.tsx`

| ID | Test Scenario | Prerequisites / Setup | Expected Result | Risk |
|----|---------------|-----------------------|-----------------|------|
| J1 | Create job → worker picks it up | Superadmin; submit valid name/procedure/cron | Row inserted, audit `SCHEDULER_JOB_CREATED`, worker restarts and logs new job scheduled | High |
| J2 | Duplicate `procedure` rejected | Create job with an existing procedure name | `CONFLICT` 23505 → friendly "already exists" toast; no partial insert | Medium |
| J3 | Edit cron inline (onBlur) | Change schedule field value, blur | `updateJob` fires once; worker restarts with new schedule; blurring unchanged value sends NO mutation | Medium |
| J4 | Toggle enabled ON→OFF | Click ON/OFF button | `enabled` flips; disabled jobs excluded by `WHERE enabled=true` in `loadJobs()` after restart | High |
| J5 | Invalid cron string | Set schedule to `not a cron` | Worker `cron.validate` fails → job skipped with warn; **no default fallback** (DB-driven path differs from old lib); UI still shows bad value | High |
| J6 | Delete job | Delete a row | Row removed, audit `SCHEDULER_JOB_DELETED`, worker restarts and no longer schedules it | High |
| J7 | Manual "Restart Worker" | Click button | IPC `restart` sent; worker stops all, reloads jobs, re-schedules; audit `SCHEDULER_WORKER_RESTART` | Medium |
| J8 | Restart while a job is mid-run | Trigger restart during an active stored-proc call | In-flight proc completes on its own connection; after restart `last_status` consistent; no duplicate concurrent run | High |
| J9 | `last_run_at/last_status/last_error` persistence | Let a job run to success then to failure | `success`/`error` + error message persisted and reflected in UI status badge | High |
| J10 | Empty-update guard | Call `updateJob` with only `{id}` (no other fields) | `BAD_REQUEST` "No fields to update"; no DB write; no worker restart | Low |
| J11 | Restart storm | Rapidly create/edit/delete several jobs | Worker converges to correct final job set; no zombie tasks; not wedged by overlapping restarts | High |
| J12 | Seed parity | Fresh `npm run db:migrate` | Seeded `scheduler_jobs` match intended procedure list (`sp_process_*`, `sp_recap_*`, housekeeping); no missing/duplicate entries | Medium |

---

## 3 · FDW auto-apply (`DROP … CASCADE` DDL)

`src/lib/fdw-setup.ts`, `src/lib/fdw.ts`, `src/server/trpc/routers/fdw.ts`, `src/routes/_dashboard/superadmin/config.tsx`

| ID | Test Scenario | Prerequisites / Setup | Expected Result | Risk |
|----|---------------|-----------------------|-----------------|------|
| F1 | Add FDW source auto-applies | Superadmin; add `source_db` + `table` for reachable remote DB | Row inserted, `applyFdwConfig` runs inline, foreign table + compat view created; toast reports `N table(s) applied`; data SELECTable via short view name | High |
| F2 | Remove FDW source re-applies remaining | Remove one of several sources | Remaining sources re-applied (full drop+recreate of all servers); removed table's view gone; others still work | High |
| F3 | `DROP SERVER … CASCADE` blast radius | View/query depending on foreign table exists during re-apply | CASCADE drops only FDW objects; no app table or data lost; recap output table counts unchanged before/after | High |
| F4 | Concurrent FDW applies | Trigger "Re-apply FDW" twice in quick succession (two browser tabs) | Global `_fdw_import_tmp` schema collision: one apply errors cleanly; no half-imported table left behind. Document actual behavior | High |
| F5 | Long identifier truncation | Source + table whose `{db}_{table}` > 63 bytes | `fdwLocalRelationName` truncates to 55 + 7-hex md5 suffix; matches the copy in `src/db/migrate.ts` (must stay in sync) | High |
| F6 | Duplicate view name collision (two DBs, same table name) | Two source DBs exporting identically named `table_name` | First claims the compat view (`claimedViewNames`); second gets only its prefixed foreign table; no error, no silently wrong view | Medium |
| F7 | Unreachable remote DB | Add a source pointing at a dead host | `applyFdwConfig` collects error in `result.errors`; mutation returns success-with-errors message; bad source doesn't block good ones | High |
| F8 | `DB_USER_TARGET` grants | Set `DB_USER_TARGET` env var | User mapping + `GRANT USAGE`/`SELECT` created for that role; grant failures non-fatal (pushed to errors array) | Medium |
| F9 | Manual "Re-apply FDW" button | Config page → click Re-apply | `applyFdw` mutation runs, audit `FDW_MANUAL_APPLY`, server/table counts in toast; list refetches | Medium |
| F10 | Add duplicate source | Add an existing `(source_db, table)` pair | `CONFLICT` "already exists"; no second row; no destructive re-apply triggered by failed insert | Medium |
| F11 | Identifier/DDL safety with special chars | Source name or table containing quotes/special chars | `esc()` escapes single-quotes; identifiers use double-quote escaping; no SQL injection or broken DDL | High |
| F12 | Migration `--fdw-only` standalone | `npm run db:migrate:fdw` | Phase 4b runs `applyFdwConfig(migrationPool)` alone; idempotent on re-run; same result as UI apply | Medium |

---

## 4 · Processing page — batch table

`src/routes/_dashboard/superadmin/processing.tsx`, `recap.triggerManual`, `processingLogs.byMonth`

| ID | Test Scenario | Prerequisites / Setup | Expected Result | Risk |
|----|---------------|-----------------------|-----------------|------|
| P1 | **"today" boundary / timezone** | View current month near local midnight (Asia/Jakarta) | `todayStr = today.toISOString().split('T')[0]` may shift the date back a day in UTC+7. Verify "today" badge and `< today` processable cutoff land on the **correct calendar day**; future dates remain non-processable | High |
| P2 | Single-date manual process | Select a job, click Process on a past date | `triggerManual` runs; toast shows records processed/inserted; 500ms delay then logs refetch; row status updates | High |
| P3 | Batch "Process selected" | Select several dates, run | Sequential processing; progress `current/total`; final toast tallies succeeded/failed; selection cleared; logs refetched | High |
| P4 | Batch "Process all" | Click Process all (all processable dates) | All past dates of the month processed in sorted order; no future/today dates included | High |
| P5 | Cancel mid-batch | Start a long batch, click Cancel | `cancelBatchRef` stops loop after current date; toast reports succeeded/failed/**skipped**; no further triggers fire | High |
| P6 | Navigate away mid-batch | Start batch, route to another page | No orphaned mutations or unhandled rejections; document whether batch halts or continues | Medium |
| P7 | Failed proc surfaces correctly | Process a date the stored proc rejects | Status `failed`, red error text (truncated, full on hover); batch counts it as failed not succeeded | High |
| P8 | Job switch resets selection | Change Job / Month / Year mid-selection | `selectedDates` cleared (useEffect dependency on `catalogEntryId, month, year`); no stale cross-job dates processed | Medium |
| P9 | Empty catalog guard | No catalog entries / query loading | "No job selected" empty state; controls disabled; no crash on `catalogEntries[0]` | Medium |
| P10 | Idempotent re-process | Process same date twice | Stored proc handles re-run (upsert / no duplicate inserts); `records_inserted` reflects truth, not doubled count | High |
| P11 | Summary tile accuracy | Month with mixed statuses | Success/Failed/Running/Not-processed/Total counts match table rows exactly | Low |
| P12 | Concurrency guard | Click row's Process while a batch runs | Per-row buttons + checkboxes disabled during `isBatchRunning`; no overlapping triggers for same job | Medium |

---

## 5 · tRPC migration — auth, parity, error mapping

`src/server/trpc/routers/*`, `src/server/trpc/init.ts`

| ID | Test Scenario | Prerequisites / Setup | Expected Result | Risk |
|----|---------------|-----------------------|-----------------|------|
| T1 | `superAdminProcedure` enforcement | Call scheduler/fdw/recap mutations as non-superadmin | `UNAUTHORIZED`/`FORBIDDEN`; no data change; verify EVERY superadmin route is guarded | High |
| T2 | Unauthenticated access | Hit protected query with no session | Rejected before handler; no DB query runs | High |
| T3 | REST → tRPC parity (no dead UI) | Click through every dashboard page | All data loads via tRPC; no 404s to old `/api/*` REST paths; network tab shows only tRPC batch calls | High |
| T4 | Audit log coverage | Create/update/delete across modules | Each mutation writes `logAuditEvent` with correct actor (`ctx.session.userId/username`), entity, and detail string | Medium |
| T5 | Error-code mapping | Trigger NOT_FOUND / CONFLICT / BAD_REQUEST cases | tRPC codes map to correct HTTP status + user-facing toast text; `RecapValidationError` → NOT_FOUND/BAD_REQUEST | Medium |
| T6 | SSR-disabled routes on hard navigation | Load `/superadmin/processing` or `/superadmin/scheduler` directly via URL | Client-only render works; no hydration mismatch | Medium |

---

## 6 · External trigger API — backward compatibility

`recap.triggerExternal` (`src/server/trpc/routers/recap.ts`)

| ID | Test Scenario | Prerequisites / Setup | Expected Result | Risk |
|----|---------------|-----------------------|-----------------|------|
| E1 | Old REST endpoint removed | `curl POST /api/processing/process-manual` | Returns 404 — **check no external cron/integration still calls it; update callers to tRPC endpoint** | High |
| E2 | Valid API-key trigger | POST with correct `x-recap-api-key` + `app_name` or `catalogEntryId` | Recap triggered; audit `RECAP_EXTERNAL_TRIGGER` with IP/UA; result returned | High |
| E3 | Missing or wrong API key | POST with bad/no key | `UNAUTHORIZED`; nothing runs; error does not leak which part failed | High |
| E4 | API key unset in env | `RECAP_TRIGGER_API_KEY` empty or absent | All external triggers rejected (fail-closed); never open | High |
| E5 | `app_name` → key normalization | POST `app_name` only | `normalizeAppNameToKey` resolves to `sr:<key>`; matches catalog; bad name → `BAD_REQUEST` | Medium |
| E6 | Date format validation | POST `date` not matching `YYYY-MM-DD` | Zod regex rejects with clear message; no proc runs | Medium |
| E7 | Default H-1 behavior | POST with no `date` | Processes H-1 (yesterday) per proc's NULL-date convention; audit notes "(H-1)" | Medium |

---

## 7 · PostgreSQL-only migration & stored procedures

`src/db/migrate.ts`, `drizzle/`, `src/db/schema/*`

| ID | Test Scenario | Prerequisites / Setup | Expected Result | Risk |
|----|---------------|-----------------------|-----------------|------|
| D1 | Fresh DB full migrate | Empty Postgres → `npm run db:migrate` | Schema + procedures + FDW + seeds created; exits 0; no MySQL syntax errors | High |
| D2 | Idempotent re-migrate | Run `db:migrate` twice in a row | Second run skips existing via `tableExists`/`columnExists` guards with `⏭` logs; no duplicate data, no errors | High |
| D3 | Partial flag correctness | `--schema-only`, `--procedures-only`, `--seed-only`, `--fdw-only` | Each runs only its phase; combinable; `RUN_ALL` only when no flag set | Medium |
| D4 | Stored-proc call signature | Worker or manual trigger calls `SELECT public.<proc>(NULL::date)` | All `sp_process_*`/`sp_recap_*` accept a single nullable `date` arg; matches both call sites (worker raw SQL + lib) | High |
| D5 | No residual MySQL code | Search codebase/config for mysql driver or MySQL-specific SQL | MySQL fully removed; only `pg`/Drizzle present; all connection strings are Postgres | High |
| D6 | Housekeeping targets prefixed foreign table | Run housekeeping delete | `resolvePgHousekeepingRelation` targets the prefixed foreign table, not the compat view (view DELETE on foreign table is unreliable) | High |
| D7 | `raw_table_housekeeping.date_column_type` column | Migrate onto older DB missing the column | ALTER adds it; downstream housekeeping reads it without error | Medium |
| D8 | Seed = superadmin only | Run seed phase | Only superadmin user seeded; no app/FDW/housekeeping data injected | Medium |

---

## 8 · Auth (better-auth + argon2)

`src/server/trpc/routers/auth.ts`, better-auth config, `db:seed-superadmin`

| ID | Test Scenario | Prerequisites / Setup | Expected Result | Risk |
|----|---------------|-----------------------|-----------------|------|
| A1 | Superadmin login | Run `db:seed-superadmin`, then log in | Session created; argon2 hash verified; superadmin routes accessible | High |
| A2 | Wrong password | Bad credentials | Rejected; no session created; timing/error message does not leak user existence | High |
| A3 | Session persistence | Log in, hard-refresh page, navigate | Session survives reload; tRPC ctx has `session.userId/username` | High |
| A4 | Trusted origins / CSRF | Cross-origin request | `BETTER_AUTH_TRUSTED_ORIGINS` enforced; disallowed origin blocked | High |
| A5 | Logout | Sign out | Session invalidated; protected routes redirect or deny | Medium |
| A6 | Role gating in UI | Log in as non-superadmin | `useSuperadminGuard` hides/blocks superadmin pages; server still re-checks (no client-only guard) | High |

---

## 9 · Cross-cutting — env, build, config

`src/env.ts`, `vite.config.ts`, `package.json` build scripts

| ID | Test Scenario | Prerequisites / Setup | Expected Result | Risk |
|----|---------------|-----------------------|-----------------|------|
| C1 | Env validation fail-fast | Unset a required var (`DB_HOST`, `BETTER_AUTH_SECRET`) | App refuses to boot with a clear Zod error; no half-started state | High |
| C2 | Server env never in client bundle | Inspect built client JS assets | No `DB_PASSWORD`/`BETTER_AUTH_SECRET` present; only `VITE_`-prefixed client vars | High |
| C3 | Worker bundle externals | `pnpm build && pnpm start` | esbuild bundles worker; `pg`/`drizzle-orm`/`node-cron`/`dotenv` resolved as node externals at runtime | High |
| C4 | node-cron v4 timezone | Job configured with `Asia/Jakarta` vs UTC | Fires at correct wall-clock time for configured timezone; default `SCHEDULER_TIMEZONE` env honored | High |
| C5 | Docs reader `/docs` | Open in-app docs, deep link to `/docs/$` slug | Markdown renders; missing slug handled without crash; navigation works | Low |
| C6 | Dictionary + unmapped-RC merge | Open dictionary page | Merged unmapped-RC panel shows correct data; old standalone `/unmapped-rc` route still resolves or redirects as intended | Medium |
| C7 | Lint/type-check clean | `pnpm type-check && pnpm lint` | Zero type errors; zero Biome violations | Low |

---

## Verification — end-to-end checklist

1. **Build both targets**: `pnpm build` (app + `build:worker`); `pnpm start` — watch logs for `[scheduler-worker] Ready (pid=…)` (covers S3, C3).
2. **Dev loop**: `pnpm dev` — confirm one worker PID and no old-scheduler logs (S1, S2, S8).
3. **DB idempotency**: against a disposable Postgres, run `npm run db:migrate` twice; use `dz:studio` to inspect `scheduler_jobs` / `fdw_source_table` (D1, D2).
4. **Worker resilience**: `kill <workerPid>` and watch parent backoff/restart (S4, S5).
5. **FDW**: add/remove/re-apply from Config page against a throwaway remote DB; verify foreign tables + views in `dz:studio`; confirm recap output table counts unchanged across a CASCADE re-apply (F1–F4, F11).
6. **External API**: `curl` the tRPC `triggerExternal` endpoint with correct/wrong `x-recap-api-key`; confirm old REST path returns 404 (E1–E4).
7. **Type/lint gate**: `pnpm type-check && pnpm lint` clean (C7).

Any **High**-risk failure = release blocker.
