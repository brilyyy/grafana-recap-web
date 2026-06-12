# Grafana Recap Web

Transaction success-rate monitoring, RC dictionary management, and operational reconciliation dashboard.

## Tech Stack
- TanStack Start + TanStack Router (file-based routing)
- React 19 + TypeScript
- Vite 8
- Tailwind CSS v4 + shadcn/ui
- tRPC (classic react-query style)
- Drizzle ORM (PostgreSQL)
- BetterAuth (username/password sessions, argon2 hashing)
- Biome (lint/format)
- PostgreSQL with postgres_fdw; recap jobs run via the app-level node-cron scheduler

## Pages
All dashboard pages live under the authenticated `_dashboard` layout (sidebar + breadcrumb):

| Route | Page |
|-------|------|
| `/` | Summary — stat cards (apps, dictionary, unmapped RCs, no-RC transactions) + recent processing runs |
| `/application` | Application management |
| `/dictionary` | RC dictionary (filter, inline edit, bulk description, CSV export) |
| `/uploads` | Success-rate + dictionary file uploads (`.xlsx` / `.csv`) |
| `/unmapped-rc` | Classify unmapped response codes (S / N / Sukses) |
| `/transactions` | Assign RCs to transactions without one |
| `/superadmin/*` | Users, audit logs, processing, jobs, app config, housekeeping (superadmin only) |
| `/login`, `/register` | Auth pages (first registration creates the initial admin; later ones queue for approval) |

## Quick Start
```bash
pnpm install
pnpm dev
```

## Environment
Validated at startup by `src/env.ts` (custom zod validator — server vars come from
`process.env`, browser-safe vars must be prefixed `VITE_` and go through `clientEnv`).
Required: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`.
Optional: scheduler cron expressions (`*_PROCESSING_SCHEDULE`, default `1 0 * * *`),
`SCHEDULER_TIMEZONE` (default `Asia/Jakarta`), `BETTER_AUTH_TRUSTED_ORIGINS`, seed credentials.

## Build and Run
```bash
pnpm build
pnpm start    # node .output/server/index.mjs
```

## Database Migration
```bash
pnpm db:migrate
```

Phase-specific commands:
- `pnpm db:migrate:schema`
- `pnpm db:migrate:procedures`
- `pnpm db:migrate:seed`
- `pnpm db:migrate:fdw`

## Lint / Format
```bash
pnpm lint       # biome check .
pnpm lint:fix   # biome check --write .
pnpm format     # biome format --write .
```

## Documentation
- [Documentation Hub](docs/README.md)
- [Server Configuration](docs/technical/server-config.md)
- [Feature Docs](docs/features/README.md)
- [Technical Docs](docs/technical/README.md)
- [Success Rate SQL README](scripts/success_rate/README.md)
