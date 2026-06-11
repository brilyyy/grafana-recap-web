# Migration Plan: grafana-recap-web — Next.js 14 → TanStack Start + Modernization

## Context

Dashboard app (Grafana recap CMS, PostgreSQL) currently on Next.js 14 App Router with a custom server (server.js + instrumentation.ts) running node-cron jobs that invoke PostgreSQL stored procedures. Data access goes through a raw-SQL pool shim (`src/lib/db.ts`, `?`→`$n` conversion) despite Drizzle being installed (only better-auth uses it). 35 REST routes heavily duplicate the 12 tRPC routers. Goal: migrate to TanStack Start (latest), modernize UI to pure latest shadcn, convert raw SQL to Drizzle where expressible, modularize schema, prune redundant REST, drop Docker, update all packages, switch lint/format to Biome — without breaking functionality at any phase.

**Decisions made:**
- Visual style: **full stock shadcn** — drop gradient/glassmorphism/custom animations entirely
- Docs: README.md / CLAUDE.md / AGENTS.md stay at root; SERVER_CONFIG.md → docs/technical/; DOCKER.md deleted
- node-cron: **upgrade to v4** (breaking major — migrate scheduler.ts API, test all 8 jobs)

## Verified target versions (June 2026)

| Package | Current → Target |
|---|---|
| @tanstack/react-start | — → ~1.168 |
| @tanstack/react-router | — → ~1.170 |
| react / react-dom | 18.3 → 19.2 |
| vite | — → 8.x (pin 7.x if issues) |
| tailwindcss | 3.4 → 4.3 (+@tailwindcss/vite, tw-animate-css) |
| @biomejs/biome | — → 2.4 |
| better-auth | 1.4.19 → 1.6.x (`tanstackStartCookies` from `better-auth/tanstack-start`) |
| @trpc/* | 11.10 → 11.17 (keep classic `@trpc/react-query` style) |
| @t3-oss/env-nextjs → @t3-oss/env-core 0.13 |
| node-cron | 3.0.3 → 4.2 (breaking; migrate scheduler API) |
| drizzle-orm/kit | already latest (0.45/0.31) |
| xlsx | keep 0.18.5 (npm upstream abandoned; do NOT blind-update) |

Current TanStack Start APIs (re-verify exact syntax against installed version at impl time):
- Vite plugin `tanstackStart()` from `@tanstack/react-start/plugin/vite` + `@vitejs/plugin-react`
- Server routes unified into `createFileRoute(...)({ server: { handlers: { GET, POST } } })`
- Middleware: `createMiddleware().server(...)`; global via `createStart(() => ({ requestMiddleware: [...] }))` in `src/start.ts`
- Server entry `src/server.ts` (`createServerEntry`) — module-level init runs once at boot (scheduler home)
- better-auth catch-all: `src/routes/api/auth/$.ts` → `auth.handler(request)`

App builds/runs at end of every phase. Phases 1–2 still on Next.js (independently verifiable); Phase 3 = atomic framework swap on a branch.

---

## Phase 1 — Frontend fetch() → tRPC (still on Next.js)

### 1.1 Add missing tRPC procedures (reuse REST handler logic verbatim)
- [ ] Audit `src/server/trpc/routers/auth.ts` — confirm `listPendingRequests`, `approvePendingRequest`, `rejectPendingRequest` exist and match REST behavior (`/api/auth/pending-user-requests`, `/api/auth/approve-user-request/[id]`, `/api/auth/reject-user-request/[id]`); add/fix gaps
- [ ] Verify `auditLogs.getStats` covers `/api/audit-logs/stats?days=N` (days param); add if missing
- [ ] Add `recap.processManual` mutation (session-auth, superadmin) mirroring `/api/processing/process-manual` logic — REST route stays for API-key external callers
- [ ] Verify `processingLogs.list` covers all filters used by superadmin page

### 1.2 Migrate components/pages off fetch()
- [ ] `src/app/superadmin/page.tsx`: `/api/users*` → `trpc.users.list/get/update/delete/create`
- [ ] `src/app/superadmin/page.tsx`: pending-user-requests + approve/reject → `trpc.auth.*`
- [ ] `src/app/superadmin/page.tsx`: `/api/audit-logs*` + stats → `trpc.auditLogs.list/getStats`
- [ ] `src/app/superadmin/page.tsx`: `/api/processing-logs` → `trpc.processingLogs.list`
- [ ] `src/app/superadmin/page.tsx`: `/api/processing/process-manual` → `trpc.recap.processManual`
- [ ] `src/components/DictionaryCard.tsx`: `/api/dictionary`, `update`, `update-description`, `update-description-batch` → `trpc.dictionary.list/updateErrorType/updateDescription/updateDescriptionBatch`
- [ ] `src/components/UnmappedRcCard.tsx`: list/submit/submit-batch → `trpc.unmappedRc.*`
- [ ] `src/components/NoRcTransactionCard.tsx`: list/submit/submit-batch → `trpc.noRcTransaction.*`
- [ ] `src/components/AddAppCard.tsx`: POST `/api/applications` → `trpc.applications.create`
- [ ] `src/components/AddSuccessRateCard.tsx`: applications list → tRPC (upload itself stays REST)
- [ ] Leave as REST (intentional): login page `/api/auth/login`, `DictionaryUploadCard` `/api/upload-dictionary`, `AddSuccessRateCard` `/api/upload-success-rate`, `RestartDbCard` `/api/restart-db`
- [ ] Do NOT delete any REST route yet (Phase 6)

### 1.3 Verify
- [ ] `pnpm type-check` clean
- [ ] `pnpm build` clean
- [ ] Manual: superadmin all tabs, dictionary edit, unmapped-rc submit, no-rc submit, app add, user approval flow

---

## Phase 2 — Drizzle: schema modularization + raw SQL conversion (still on Next.js)

### 2a. Split `src/db/schema/pg.ts` (322 lines, 12 tables, 4 enums)
- [ ] Create `src/db/schema/enums.ts` — userRoleEnum, requestedRoleEnum, requestStatusEnum, errorTypeEnum
- [ ] Create `src/db/schema/auth.ts` — users, sessions, accounts, verifications, pendingUserRequests + relations
- [ ] Create `src/db/schema/applications.ts` — appIdentifier, appSuccessRate + relations
- [ ] Create `src/db/schema/dictionary.ts` — responseCodeDictionary, unmappedRc + relations
- [ ] Create `src/db/schema/logging.ts` — appProcessingLog, auditLogs, rateLimitLogs + relations
- [ ] Create `src/db/schema/index.ts` barrel (`export *` each module)
- [ ] Update `src/db/index.ts` → `import * as schema from './schema'`
- [ ] Update `drizzle.config.ts` → `schema: './src/db/schema/index.ts'`
- [ ] Update `src/lib/better-auth.ts` schema imports
- [ ] Temporarily make `pg.ts` re-export `./index`; grep `schema/pg` importers, update all, delete `pg.ts`
- [ ] **Gate:** `pnpm drizzle:postgres:generate` produces EMPTY diff (any diff = transcription error — fix before continuing)

### 2b. Eliminate pool shim `src/lib/db.ts`
- [ ] `src/server/trpc/routers/applications.ts` → Drizzle query builder (list, getById, create, updateConfig)
- [ ] `src/server/trpc/routers/users.ts` → Drizzle (list w/ search+role filter+pagination, get, update, delete, create)
- [ ] `src/server/trpc/routers/dictionary.ts` → Drizzle (list w/ search/filter/JOIN, 3 update mutations)
- [ ] `src/server/trpc/routers/unmappedRc.ts` → Drizzle (list, submit, submitBatch, updates, deletes)
- [ ] `src/server/trpc/routers/noRcTransaction.ts` → Drizzle (list, submit, submitBatch, batch update)
- [ ] `src/server/trpc/routers/auditLogs.ts` → Drizzle (list w/ filters + count, getStats)
- [ ] `src/server/trpc/routers/processingLogs.ts` → Drizzle (list + JOIN app_identifier, getAppName)
- [ ] `src/server/trpc/routers/auth.ts` → pending-user-request CRUD to Drizzle; better-auth tables untouched
- [ ] `src/server/trpc/routers/recap.ts` → reads to Drizzle; stored-proc calls stay ``db.execute(sql`SELECT public.sp_…(${date}::date)`)``
- [ ] `src/server/trpc/routers/system.ts` → `db.execute(sql\`SELECT 1\`)` (raw OK)
- [ ] `src/server/trpc/routers/fdw.ts` → stay raw via `db.execute(sql\`…\`)` (FDW DDL not expressible)
- [ ] `src/server/trpc/routers/housekeeping.ts` → config-table CRUD to Drizzle where trivial; dynamic SQL/proc execution stays `db.execute`
- [ ] `src/lib/audit.ts` → `db.insert(auditLogs)`
- [ ] `src/lib/rateLimit.ts` → inspect; rate_limit_logs insert to Drizzle
- [ ] `src/lib/scheduler.ts` → stored-proc calls via `db.execute(sql\`…\`)` (drop pool shim import)
- [ ] `src/application/recap/trigger-recap.ts` → Drizzle for app-identifier reads
- [ ] `src/db/migrate.ts` → stay raw; swap pool shim for underlying pg Pool or `db.execute(sql.raw(...))`
- [ ] Kept REST routes (uploads, login, restart-db, process-manual, migrate-schema, db-status) → Drizzle/db.execute; redundant REST routes left untouched (die in Phase 6)
- [ ] Delete `src/lib/db.ts`; grep `lib/db` = zero hits

### 2c. Verify
- [ ] `pnpm type-check`, `pnpm build` clean
- [ ] Manual pass: every card + all superadmin tabs (CRUD each entity)
- [ ] Trigger one manual processing run — stored-proc path works
- [ ] `drizzle:postgres:generate` still empty diff

---

## Phase 3 — Framework swap: Next.js → TanStack Start (+React 19) — branch, atomic

Keep Tailwind v3 via PostCSS during this phase (don't stack Tailwind v4 risk).

### 3a. Branch + packages
- [ ] Create branch `migrate/tanstack-start`
- [ ] Re-verify TanStack Start docs against installed version: server-routes syntax, middleware, server entry, hosting output layout
- [ ] Remove: next, eslint-config-next, @t3-oss/env-nextjs, multer + @types/multer, tsconfig-paths
- [ ] Grep `jsonwebtoken` usage; if unused remove + @types
- [ ] Delete stale `package-lock.json` (pnpm only)
- [ ] Add: @tanstack/react-start, @tanstack/react-router, @tanstack/react-router-devtools (dev), vite@8, @vitejs/plugin-react, vite-tsconfig-paths, @t3-oss/env-core
- [ ] Upgrade: react/react-dom@19 + types, better-auth@1.6 (read 1.4→1.6 changelog re: cookies/session schema), @trpc/*@11.17, @tanstack/react-query@5.101, @types/node@24, node-cron@4, zod@4.4
- [ ] package.json `"type": "module"`

### 3b. Scaffold
- [ ] `vite.config.ts`: tanstackStart() + viteReact() + tsconfigPaths; server.port 3000
- [ ] `src/router.tsx`: getRouter() + routeTree.gen; QueryClient + tRPC client wiring (absorb `src/components/providers/TRPCProvider.tsx`, then delete it)
- [ ] `src/routes/__root.tsx`: html shell (HeadContent/Scripts), globals.css import, TRPCProvider wrap (from src/app/layout.tsx)
- [ ] `src/start.ts`: createStart + global rateLimitMiddleware ported from `src/middleware.ts`; reuse `src/lib/rateLimit.ts`; **fix latent bug**: `['POST',…].includes(pathname)` should check `request.method`
- [ ] `src/server.ts`: createServerEntry; module-level scheduler init gated on `USE_APP_LEVEL_SCHEDULER` + `globalThis.__schedulerStarted` HMR guard (replaces server.js + instrumentation.ts)
- [ ] Migrate `src/lib/scheduler.ts` to node-cron v4 API (ESM import, changed task options — read v4 migration notes); all 8 jobs
- [ ] tsconfig: moduleResolution Bundler, module ESNext, vite/client types, drop next plugin, keep `@/*` alias
- [ ] Scripts: `dev: vite dev`, `build: vite build`, `start: node .output/server/index.mjs` (verify output path; consider nitro plugin for node preset)

### 3c. Page routes (all `ssr: false` initially — break-nothing lever)
- [ ] `src/app/page.tsx` → `src/routes/index.tsx`
- [ ] `src/app/login/page.tsx` → `src/routes/login.tsx`
- [ ] `src/app/register/page.tsx` → `src/routes/register.tsx`
- [ ] `src/app/audit-logs/page.tsx` → `src/routes/audit-logs.tsx`
- [ ] `src/app/superadmin/page.tsx` → `src/routes/superadmin.tsx` (2271 lines — careful)
- [ ] `src/app/user-approval/page.tsx` → `src/routes/user-approval.tsx`
- [ ] Sweep: `useRouter().push(x)` → `useNavigate()({ to: x })` (7 files incl. `src/components/LogoutButton.tsx`)
- [ ] Sweep: `next/link` → `@tanstack/react-router` `<Link to>` (login, register)
- [ ] Strip all `'use client'` directives

### 3d. Kept REST → server routes
- [ ] `api/auth/[...all]` → `src/routes/api/auth/$.ts` → `auth.handler(request)` (GET+POST)
- [ ] `api/auth/login` → `src/routes/api/auth/login.ts` — **test static-beats-wildcard precedence vs $.ts**; fallback: fold audit into better-auth hooks
- [ ] `api/upload-dictionary` → server route: `request.formData()` → `file.arrayBuffer()` → Buffer → xlsx; `file.size` ≤10MB check
- [ ] `api/upload-success-rate` → same pattern
- [ ] Delete `src/lib/multer.ts` + multer usage
- [ ] `api/processing/process-manual` + `api/bale/process-manual` → same paths; RECAP_TRIGGER_API_KEY check unchanged
- [ ] `api/restart-db`, `api/migrate-schema` → 1:1 port
- [ ] `api/trpc/[trpc]` → `src/routes/api/trpc/$.ts` — fetchRequestHandler (@trpc/server/adapters/fetch), `createTRPCContext({ headers: request.headers })`

### 3e. De-Next server libs
- [ ] `src/server/trpc/init.ts`: drop next/headers; headers = required ctx arg
- [ ] `src/lib/auth.ts`: drop next/headers/NextRequest; `getSession(request)`; or `getRequestHeaders()` from @tanstack/react-start/server
- [ ] `src/lib/better-auth.ts`: `nextCookies()` → `tanstackStartCookies()` from `better-auth/tanstack-start` (must be LAST plugin)
- [ ] `src/lib/api-helpers.ts`: NextResponse → `Response.json`; handlers take `Request`
- [ ] `src/env.ts`: @t3-oss/env-core, `emptyStringAsUndefined: true`; ensure never imported from client graph

### 3f. Delete Next artifacts
- [ ] next.config.js, server.js, instrumentation.ts, src/middleware.ts, next-env.d.ts
- [ ] `src/app/**` after port (redundant REST handlers not ported — any remaining consumer = Phase 1 miss, fix it)

### 3g. Verify
- [ ] `pnpm type-check` clean
- [ ] `pnpm dev`: login works (better-auth cookies!), all 6 pages render, all cards CRUD
- [ ] Both uploads (xlsx + csv)
- [ ] curl process-manual with RECAP_TRIGGER_API_KEY → 200
- [ ] curl spam → 429 rate limit
- [ ] `pnpm build && pnpm start` prod smoke
- [ ] `USE_APP_LEVEL_SCHEDULER=true` boot → 8 cron registrations logged (node-cron v4)

---

## Phase 4 — Tailwind v4 + latest shadcn + custom CSS removal (full stock look)

- [ ] Remove tailwindcss@3, postcss, autoprefixer, tailwindcss-animate; add tailwindcss@4, @tailwindcss/vite, tw-animate-css
- [ ] Delete tailwind.config.ts, postcss.config.js; add `tailwindcss()` to vite plugins
- [ ] Create `src/styles/app.css`: `@import "tailwindcss"; @import "tw-animate-css";` + stock shadcn neutral theme (oklch vars from shadcn init)
- [ ] components.json: `tailwind.config: ""`, `css: "src/styles/app.css"`
- [ ] Re-pull latest: `pnpm dlx shadcn@latest add alert badge button card dialog input label scroll-area separator table select` (React-19 aligned, data-slot, no forwardRef)
- [ ] Replace native `<select>`s (superadmin page + cards) with shadcn Select — kills `[data-page="superadmin"]` CSS hack
- [ ] Sweep `.glass-card` usages → `Card` component / `bg-card border shadow-sm`
- [ ] Sweep `.bento-grid`/`.bento-item` → `grid gap-4 lg:gap-6` + `h-full flex flex-col`
- [ ] Sweep `.animate-fade-in`/`.animate-slide-in`/`.shimmer`/`.animate-pulse-slow` → tw-animate-css (`animate-in fade-in slide-in-from-bottom-5`) or drop
- [ ] v4 rename sweep: shadow-sm→shadow-xs, rounded-sm→rounded-xs, outline-none→outline-hidden, ring→ring-3, flex-shrink-*→shrink-*, bg-gradient-to-r→bg-linear-to-r
- [ ] Drop entirely: animated gradient body, custom scrollbar, glass effects, keyframes, form override hacks
- [ ] Delete `src/app/globals.css`; update `__root.tsx` css import → app.css
- [ ] **Verify:** visual pass all 6 pages, dialogs, tables, selects, scroll areas; `pnpm build`

---

## Phase 5 — Biome

- [ ] Add @biomejs/biome@2.4 (dev); remove eslint + .eslintrc.json
- [ ] `biome.json`: schema 2.x, `vcs.useIgnoreFile: true`, formatter matching existing style, linter recommended; ignore routeTree.gen.ts, drizzle/, migration-kit/
- [ ] Scripts: `lint: biome check .`, `lint:fix: biome check --write .`, `format: biome format --write .`
- [ ] Run `biome check --write .` — mechanical reformat as its own commit
- [ ] Fix surfaced lint findings (separate commit)
- [ ] **Verify:** `pnpm lint`, type-check, build

---

## Phase 6 — Deletions + docs

### 6.1 REST removal
- [ ] Grep `fetch('/api` + `fetch(\`/api` — zero non-kept consumers required
- [ ] `LogoutButton` → better-auth client `signOut()` (drop `/api/auth/logout`)
- [ ] Delete redundant routes: applications, users, dictionary/*, unmapped-rc/*, no-rc-transaction/*, processing-logs, audit-logs/*, db-status
- [ ] Delete redundant auth REST: check, check-admin, create-admin, create-user, logout, pending-user-requests, approve/reject/submit-user-request
- [ ] Surviving server routes only: auth/$, auth/login, trpc/$, upload-dictionary, upload-success-rate, processing/process-manual, bale/process-manual, restart-db, migrate-schema

### 6.2 Docker removal
- [ ] Delete Dockerfile, docker-compose.yml, docker-compose.dev.yml, .dockerignore, DOCKER.md
- [ ] Delete deploy/ zips, scripts/deploy-pack.cjs, `deploy:pack`/`build:deploy` scripts

### 6.3 Docs
- [ ] SERVER_CONFIG.md → docs/technical/server-config.md (update pg_cron notes for new stack)
- [ ] Rewrite README.md: new stack, vite scripts, `node .output/server/index.mjs` start, scheduler in src/server.ts, no standalone build
- [ ] Rewrite CLAUDE.md project sections (structure, commands)
- [ ] Update AGENTS.md if it references Next
- [ ] Sweep docs/features/* + docs/technical/* for Next.js API-route/framework references; update

### 6.4 Cleanup
- [ ] package.json rename `dashboard-grafana-nextjs` → `grafana-recap-web`
- [ ] Drop cross-env if drizzle scripts simplified
- [ ] Prune dead deps: `pnpm ls` review (bcryptjs stays — pending-request flow)

---

## Phase 7 — Final verification

- [ ] Clean `pnpm install` (fresh node_modules)
- [ ] `pnpm type-check` clean
- [ ] `pnpm lint` clean
- [ ] `pnpm build` clean
- [ ] `pnpm start` prod smoke: login → dashboard → all superadmin tabs → dictionary CRUD → both uploads → unmapped-rc/no-rc submits → user approval → audit-logs → restart-db
- [ ] curl API-key triggers (processing + bale) → 200
- [ ] curl spam → 429
- [ ] `drizzle:postgres:generate` empty diff
- [ ] `pnpm db:migrate --schema-only` dry-run vs dev DB
- [ ] `USE_APP_LEVEL_SCHEDULER=true` boot → 8 jobs registered; trigger one job manually
- [ ] Merge branch

---

## Risks / verify-at-impl-time

1. **TanStack Start API churn** — re-read server-routes/middleware/server-entry guides against installed version before coding.
2. **`/api/auth/login` static vs `$.ts` wildcard precedence** — test; fallback merge into better-auth hooks.
3. **node-cron v4 breaking** (chosen): ESM, changed options/validation. Migrate scheduler.ts carefully; test every registration + one real execution. If blocked, pin 3.x and flag.
4. **better-auth 1.4→1.6**: check changelog for cookie/session schema changes; tanstackStartCookies LAST plugin.
5. **xlsx**: keep 0.18.5 (upstream moved off npm).
6. **Vite 8 peer issues** → pin 7.x.
7. **`ssr: false`** = break-nothing lever for formerly-CSR pages; real SSR/loaders = future work.
8. **Empty drizzle diff gate** after schema split — non-negotiable.

## Critical files

- src/lib/db.ts (shim to eliminate — defines Drizzle conversion surface)
- src/db/schema/pg.ts (modularization source)
- src/server/trpc/init.ts (de-Next ctx)
- src/lib/better-auth.ts (cookies plugin swap)
- src/middleware.ts → src/start.ts (rate limit port + method-vs-pathname bugfix)
- src/lib/scheduler.ts (node-cron v4 + db.execute migration)
- src/db/migrate.ts (keep raw; pool source swap only)
