---
title: PPTX Generator Overview
description: Architecture, data models, and configuration of the PPTX report generator.
---

Success-rate PowerPoint report generator. FastAPI server produces `.pptx` (charts + tables + KPIs) from **DB**, **Excel**, or **synthetic monitoring** sources.

---

## Directory Map

```
src/
├── api.py                  # FastAPI entrypoint — all endpoints
├── main.py                 # uvicorn launcher
├── constants.py            # FILE/DIR/DB paths, shape labels
├── pipeline/
│   ├── common.py           # GenerateResult, weekly-period helpers
│   ├── db.py               # DB-to-PPTX orchestration
│   └── excel.py            # Excel-to-PPTX orchestration
├── generators/
│   ├── template.py         # Main PPTX filler (transaction SR reports)
│   └── synthetic.py        # Synthetic-monitoring PPTX filler
├── services/
│   ├── db.py               # App listing facade
│   ├── mapping.py          # Synthetic mapping discovery (file-based)
│   └── mapping_db.py       # App mappings from Postgres (app_mappings)
└── lib/
    ├── data_processing/
    │   ├── _record.py      # TransactionRecord dataclass
    │   ├── _mapping.py     # AppMapping dataclass
    │   ├── _excel.py       # Excel → TransactionRecord[]
    │   └── _synthetic.py   # SyntheticRunRecord + CSV/XLSX reader
    ├── db/
    │   └── postgres.py     # Postgres queries + CSV mock
    ├── settings.py         # DatabaseSettings from env
    ├── chart.py            # save_fig() — fig → PNG bytes
    ├── report_helpers.py   # Aggregation by period, table pagination
    ├── utils.py            # Date formatting, short num, sanitize
    └── logging.py          # Colored console + rotating file logger
```

---

## Core Data Models

### TransactionRecord — `lib/data_processing/_record.py:12`

```python
@dataclass(frozen=True)
class TransactionRecord:
    date: date
    response_code: str
    response_code_desc: str
    error_type: str          # raw cell value ("A", "SE", "BE", "#N/A", …)
    trx_count: int
    trx_feature: str | None
```

**Error classification methods** (all rely on `AppMapping.format_*` lists):

| Method | Line | Logic |
|--------|------|-------|
| `is_success(mapping)` | :34 | `error_type` in `success_type_format` |
| `is_system_error(mapping)` | :37 | `error_type` in `error_type_format["system_error"]` |
| `is_business_error(mapping)` | :41 | `error_type` in `error_type_format["business_error"]` |
| `is_considered_success(mapping)` | :45 | `is_success` or `is_business_error` |
| `is_ignored(mapping)` | :20 | `response_code`/`response_code_desc` in `ignore_errors` OR `trx_feature` in `ignore_features` |

### AppMapping — `lib/data_processing/_mapping.py:19`

```python
@dataclass(frozen=True)
class AppMapping:
    name: str
    fields: dict[str, str]               # internal_name → Excel/DB column
    success_type_format: list[str]       # e.g. ["Sukses", "A"]
    error_type_format: dict[str, list]   # "system_error" → ["S","#N/A"], "business_error" → ["N","B"]
    core_fields: list[str]               # default: date, error_type, trx_count, response_code, response_code_desc
    ignore_errors: list[str]             # RC / RC_desc to drop
    ignore_features: list[str]           # trx_feature values to drop
    date_range: tuple[date,date] | None  # inclusive bounds
    weekly_periods: list[tuple[date,date]]
```

Constructed via `from_file(path)` (:51) or `from_dict(data)` (:57).

### SyntheticRunRecord — `lib/data_processing/_synthetic.py:141`

```python
@dataclass(frozen=True)
class SyntheticRunRecord:
    run_id: str
    status: str
    message: str
    start_time: datetime
    end_time: datetime
    duration_ms: int
    feature_name: str | None
    form_duration_ms: int | None
    inquiry_duration_ms: int | None
    action_date: date | None      # optional trx_date override

    @property
    def date(self) -> date:       # :155 — action_date if set, else start_time.date()
```

Classification via `SyntheticAppMapping` :59-81:
- `is_success` — status in `success_statuses`
- `is_business_error` — status in `business_error_statuses` (non-success)
- `is_system_error` — non-success, non-BE; if `failed_statuses` set, must be in it
- `is_skipped` — status in `skipped_statuses`

### GenerateResult — `pipeline/common.py:8`

```python
@dataclass
class GenerateResult:
    app_name: str
    output_path: Path | None
    success: bool
    message: str
```

---

## Config — `lib/settings.py`

| Env var | Default | Purpose |
|---------|---------|---------|
| `SR_GEN_DATABASE_URL` | — | Postgres connection string |
| `SR_GEN_DB_APP_LIST_TABLE` | — | Dimension table for app listing |
| `SR_GEN_DB_APP_LIST_ID_COLUMN` | `id` | App ID column |
| `SR_GEN_DB_APP_LIST_NAME_COLUMN` | `app_name` | App name column |
| `SR_GEN_API_KEY` | — | Optional API key auth |
| `SR_GEN_ENV` | — | `development` → mock mode |

Env loaded by `api.py:29-54` — tries `.env` in project root, then cwd, then parent chain.

## Related Docs

- [Data Pipeline](/sr-generator/pipeline) — data flow pathways and template processor
- [API & Setup](/sr-generator/api) — endpoints, DB schema, mock mode, outputs
