# Dashboard Grafana

Dashboard Grafana is a Next.js application for transaction success-rate monitoring, RC dictionary management, and operational reconciliation workflows.

## PostgreSQL-First Policy

PostgreSQL is the active database stack for this project.  
MySQL content is kept only as legacy reference and should not be extended for new work.

## Tech Stack
- Next.js 14 (App Router)
- TypeScript
- PostgreSQL (primary) with pg_cron and postgres_fdw
- Node.js 18+

## Quick Start
```bash
npm install
npm run dev
```

## Build and Run
```bash
npm run build
npm start
```

## Database Migration
```bash
npm run db:migrate
```

Phase-specific commands:
- `npm run db:migrate:schema`
- `npm run db:migrate:procedures`
- `npm run db:migrate:cron`
- `npm run db:migrate:seed`
- `npm run db:migrate:fdw`

## Documentation Map

### Level 1 - General
- [Project README](README.md)

### Level 2 - Feature Behavior
- [Feature Docs Index](docs/features/README.md)
- [Authentication](docs/features/auth.md)
- [User Management](docs/features/user-management.md)
- [Application Management](docs/features/app-management.md)
- [Dictionary Management](docs/features/dictionary-management.md)
- [Success Rate Upload](docs/features/success-rate-upload.md)
- [Unmapped RC Handling](docs/features/unmapped-rc.md)
- [No RC Transaction Handling](docs/features/no-rc-transaction.md)
- [Audit Logging](docs/features/audit-logging.md)
- [Processing Scheduler](docs/features/processing-scheduler.md)

### Level 3 - Technical Details
- [Technical Docs Index](docs/technical/README.md)
- [Authentication Technical Notes](docs/technical/auth.md)
- [User Management Technical Notes](docs/technical/user-management.md)
- [Application Management Technical Notes](docs/technical/app-management.md)
- [Dictionary Management Technical Notes](docs/technical/dictionary-management.md)
- [Success Rate Upload Technical Notes](docs/technical/success-rate-upload.md)
- [Unmapped RC Technical Notes](docs/technical/unmapped-rc.md)
- [No RC Transaction Technical Notes](docs/technical/no-rc-transaction.md)
- [Audit Logging Technical Notes](docs/technical/audit-logging.md)
- [Processing Scheduler Technical Notes](docs/technical/processing-scheduler.md)

## Operations Docs
- [Documentation Hub](docs/README.md)
- [Migration Kit README](migration-kit/README.md)
- [Success Rate SQL README](scripts/success_rate/README.md)
- [Server Configuration](SERVER_CONFIG.md)

## Related Docs
- [Documentation Hub](docs/README.md)
- [Feature Docs Index](docs/features/README.md)
- [Technical Docs Index](docs/technical/README.md)
- [Migration Kit README](migration-kit/README.md)
- [Success Rate SQL README](scripts/success_rate/README.md)
