# @repo/api

TypeScript bindings for the sr-gen API, auto-generated via [polyrpc](https://github.com/uvenkatateja/polyrpc).

## Setup

```bash
pnpm install
npx polyrpc generate   # one-time generation
npx polyrpc watch      # watch mode (regenerates on sr-gen source changes)
```

## Architecture

- **FastAPI server** lives in `/Users/brily/Dev/sr-gen/src/api.py`
- **polyrpc** reads the Python source and generates `src/lib/polyrpc.ts`
- **apps/web** imports the generated types for type-safe API calls

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/apps/db` | List DB apps |
| GET | `/apps/mappings` | List mapping files |
| POST | `/generate/db` | Generate report from DB |
| POST | `/generate/excel` | Generate report from Excel upload |
| POST | `/generate/synthetic` | Generate synthetic report |
| GET | `/reports` | List generated reports |
| GET | `/reports/{filename}` | Download report |
| DELETE | `/reports/{filename}` | Delete report |
