---
title: PPTX Generator API & Setup
description: API endpoints, database schema, mock mode, and outputs.
---

## API Endpoints — `api.py`

| Endpoint | Method | Function | Line |
|----------|--------|----------|------|
| `/health` | GET | `health()` | :137 |
| `/apps/db` | GET | `list_db_apps_endpoint()` | :159 |
| `/apps/mappings` | GET | `list_mappings()` | :172 |
| `/generate/db` | POST | `generate_db()` | :196 |
| `/generate/excel` | POST | `generate_excel()` | :228 |
| `/generate/synthetic` | POST | `generate_synthetic()` | :268 |
| `/reports` | GET | `list_reports()` | :334 |
| `/reports/{filename}` | GET | `download_report()` | :356 |
| `/reports/{filename}` | DELETE | `delete_report()` | :371 |

Auth: optional `X-API-Key` header via `_verify_api_key()` :129.

---

## DB Schema Expectations

### app_success_rate (fact table)

| Column | Type | Mapping field |
|--------|------|---------------|
| `id_app_identifier` | int | — (app_id filter) |
| `tanggal_transaksi` | date | `date` |
| `rc` | int | `response_code` |
| `rc_description` | varchar | `response_code_desc` |
| `error_type` | varchar | `error_type` |
| `total_transaksi` | int | `trx_count` |
| `jenis_transaksi` | varchar | `trx_feature` |

### app_identifier (dimension)

| Column | Type |
|--------|------|
| `id` | serial PK |
| `app_name` | varchar |

### app_mappings

| Column | Type |
|--------|------|
| `id_app_identifier` | int FK |
| `generate_from` | varchar ("db" / "excel") |
| `fields` | jsonb |
| `success_type_format` | jsonb |
| `error_type_format` | jsonb |
| `ignore_errors` | text[] |
| `ignore_features` | text[] |

---

## Mock Mode

When `SR_GEN_ENV=development`, `postgres.py` substitutes CSV files for DB queries:

| Function | File:Line | Mock Source |
|----------|-----------|-------------|
| `list_apps()` | :120 | `data/examples/app_identifier_*.csv` |
| `fetch_transaction_records_master_window()` | :198 | `data/examples/app_success_rate_*.csv` |

Mock data loaded via `_load_mock_apps()` (:47) and `_load_mock_facts()` (:77), both `@lru_cache`-d.

---

## Outputs

```
{project_root}/generated/{YYYY-MM-DD}/
  SuccessRate_{app_name}_{date}_{time}.pptx
  .{app_name}_runtime_mapping.json  (cleaned up after run)

{project_root}/logs/
  sr-gen.log        (main app — rotating, 5MBx3)
  sr_generator.log  (pipeline — rotating, 2MBx3)
```

PPTX filename format: `SuccessRate_{sanitized_app_name}_{date}_{HHMMSS}.pptx`

## Related Docs

- [Overview](/sr-generator/overview) — architecture, data models, config
- [Data Pipeline](/sr-generator/pipeline) — data flow pathways and template processor
