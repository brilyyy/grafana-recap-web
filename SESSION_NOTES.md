# Session Notes — TanStack Start Migration

## 2026-06-11

- Plan finalized in `CURRENT_PLAN.md` (7 phases, todo breakdown). Executing Phases 1–3 this session, one commit per phase.
- Baseline commit `b452c2d`: pre-existing tooling changes (skills, pnpm-lock, .mcp.json, CURRENT_PLAN.md) committed so phase commits stay clean.

### Phase 1 — fetch() → tRPC (in progress, ~30% done)

**Done (committed as WIP):**
- Audit: ALL needed tRPC procedures already existed (users, auth approval trio, dictionary, unmappedRc, noRcTransaction, applications, auditLogs, processingLogs) — no new routers needed, only 3 parity gaps fixed:
  1. `auditLogs.list` — added `resourceType` + `username` filters and `totalPages` in response (REST had them, tRPC didn't)
  2. `processingLogs.byMonth` — NEW procedure replicating REST `/api/processing-logs` (DISTINCT ON latest-log-per-date for one catalog job in a month; uses `catalogEntryToLogFilter` + `getCatalogEntryById`)
  3. `recap.triggerManual` — added `logAuditEvent` call (REST process-manual logged audit, tRPC didn't)

**Key shape facts for component migration (next steps):**
- superadmin page fetch handlers at src/app/superadmin/page.tsx lines ~218–509: fetchUsers, fetchPendingRequests, handleApprove, handleReject, handleUpdateRole, fetchAuditLogs, fetchStats, fetchProcessingLogs, handleDateProcessing
- Recommended approach: `const utils = trpc.useUtils()` + `utils.x.y.fetch(input)` inside existing imperative functions (minimal diff on 2271-line file); mutations via `useMutation` + `mutateAsync`
- Mapping: fetchUsers → `utils.users.list.fetch({page, limit:25, search?, role?})` (response `data.users`, `data.totalPages`); fetchPendingRequests → `utils.auth.pendingRequests.fetch()` (`data.requests`); handleApprove → `trpc.auth.approveRequest` ({id, approvedRole}); handleReject → `trpc.auth.rejectRequest` ({id, rejectionReason}); handleUpdateRole → `trpc.users.update` ({id, role}); fetchAuditLogs → `utils.auditLogs.list.fetch({page, limit:50, action?, resourceType?, username?, startDate?, endDate?})` (note: page state uses snake_case filter keys start_date/end_date/resource_type — map them); fetchStats → `utils.auditLogs.stats.fetch({days:30})`; fetchProcessingLogs → `utils.processingLogs.byMonth.fetch({catalogEntryId, month, year})`; handleDateProcessing → `trpc.recap.triggerManual` ({catalogEntryId, date}) — response `data.logEntry` same shape
- user-approval page ALREADY uses trpc.auth.approveRequest/rejectRequest — superadmin should match
- Components still to migrate: DictionaryCard.tsx (5 fetches → dictionary.list/updateErrorType/updateDescription/updateDescriptionBatch), UnmappedRcCard.tsx (3 → unmappedRc.*), NoRcTransactionCard.tsx (3 → noRcTransaction.*), AddAppCard.tsx (1 → applications.create)
- KEEP fetch (do not touch): login page /api/auth/login, DictionaryUploadCard /api/upload-dictionary, AddSuccessRateCard /api/upload-success-rate, RestartDbCard /api/restart-db
- REST response envelopes differ from tRPC: REST users/audit-logs return `data` = array + top-level `totalPages`; tRPC returns `data: {users|logs, total, page, limit, totalPages}` — adjust component state setters

**Pre-existing type errors on main (NOT mine, fix in Phase 2):**
- `src/db/migrate.ts(910,29)` + `migration-kit/src/db/migrate.ts(911,29)`: TS2554 Expected 1 arguments, got 2

**Phase 1 COMPLETE** (commit follows this note):
- superadmin/page.tsx: all 9 fetch handlers → tRPC (`trpc.useUtils()` imperative fetches + mutateAsync mutations; handleDateProcessing reuses existing `recapTriggerMutation`)
- DictionaryCard, UnmappedRcCard, NoRcTransactionCard, AddAppCard → tRPC (via subagent)
- **Subagent found+fixed pre-existing tRPC router bugs (routers were broken/unsued before):**
  - `noRcTransaction` router REWRITTEN — old one queried wrong table (`unmapped_rc`); REST semantics = `app_success_rate` rows where `rc IS NULL AND error_type IS NULL`, input `{id, rc, rc_description}`, auto-assign error_type from dictionary or queue into unmapped_rc. Full transactional port.
  - `unmappedRc.submit/submitBatch` — had MySQL-only `ON DUPLICATE KEY UPDATE` (would crash PG). Now PG `ON CONFLICT` upsert + app_success_rate error_type propagation + delete, in transaction. `list` gained `fetch_all`.
  - `dictionary.list` gained `app_ids[]/error_types[]/jenis_transaksi[]/fetch_all` + app_name search (UI filters depend on these); `updateErrorType` gained app_success_rate propagation.
- Imperative `utils.*.fetch()` calls pass `{staleTime: 0}` — provider default 30s would serve stale data on Refresh buttons.
- Auth tightening side-effect: unmappedRc/noRcTransaction lists now require session (REST GETs were public); applications.create requires superadmin.
- Verify: tsc clean (2 pre-existing migrate.ts errors remain), `next build` clean.
- NOT manually tested in browser (no dev DB run this session) — flag for Phase 7 smoke.

### Phase 2 — Drizzle schema split + raw SQL conversion (in progress)

**2a DONE (uncommitted yet, commits with 2b):** schema split into src/db/schema/{enums,auth,applications,dictionary,logging,index}.ts; pg.ts DELETED (zero importers remained); drizzle.config.ts → schema/index.ts; better-auth + src/db/index.ts updated. GATE PASSED: drizzle-kit generate before/after — normalized statement sets identical (42 statements; raw diff was ordering only). tsc clean (2 pre-existing migrate.ts errors only).

**2b IN FLIGHT — two background agents on disjoint files:**
- Agent 1: 12 tRPC routers + audit.ts + rateLimit.ts + trigger-recap.ts → Drizzle query builder (snake_case aliases preserve response shapes!); fdw/housekeeping stay db.execute (tables not in schema); stored procs stay db.execute
- Agent 2: scheduler.ts + migrate.ts (incl. fixing pre-existing TS2554 at :910) + kept REST routes off shim + DELETE redundant REST routes (plan change: deletion moved from Phase 6 to now because shim removal would break compile of unused routes; frontend verified migrated). Logout: agent checks LogoutButton → better-auth signOut if referenced.

**After agents:** main thread deletes src/lib/db.ts, greps zero `@/lib/db` importers, re-runs drizzle gate, tsc + next build, commits Phase 2.

### Phase 3 — TanStack Start swap (pending)
