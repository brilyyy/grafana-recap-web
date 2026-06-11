# Grafana Recap Web

Transaction success-rate monitoring, RC dictionary management, and operational reconciliation dashboard.

## Tech Stack
- TanStack Start + TanStack Router (file-based routing)
- React 19 + TypeScript
- Vite 8
- Tailwind CSS v4 + shadcn/ui
- tRPC (classic react-query style)
- Drizzle ORM (PostgreSQL)
- BetterAuth (session management)
- Biome (lint/format)
- PostgreSQL with pg_cron and postgres_fdw

## Quick Start
```bash
pnpm install
pnpm dev
```

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
- `pnpm db:migrate:cron`
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
- [Migration Kit](migration-kit/README.md)
