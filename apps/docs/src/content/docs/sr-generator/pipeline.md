---
title: PPTX Generator Data Pipeline
description: Data flow pathways and template processor for PPTX report generation.
---

## Data Flow — 3 Pathways

### 1. DB → PPTX

Triggered by `POST /generate/db` → `api.py:196`

```
api.py:196  generate_db()
  |
  +- get_database_settings() -> DatabaseSettings          lib/settings.py:56
  +- fetch_mapping(settings, app_id) -> dict              services/mapping_db.py:12
  |    +- JOIN app_mappings x app_identifier, returns fields/format/ignore
  |
  +- pipeline/db.py:120  generate_for_db_mapping()
       |
       +- _build_runtime_mapping()  :76
       |    +- Parse mapping dict -> runtime JSON
       |    +- parse date_range if present, else auto-derive (:39 _auto_runtime_date_range_for_generate_date)
       |    +- Set weekly_periods (mapping or auto) via _auto_weekly_periods_clamped()   pipeline/common.py:21
       |
       +- fetch_transaction_records_master_window()      lib/db/postgres.py:198
       |    +- Build SQL: SELECT cols FROM app_success_rate WHERE id_app_identifier=%s AND txn_date BETWEEN
       |    +- _row_to_record() :174 -> TransactionRecord[]
       |
       +- Write runtime mapping -> temp JSON
       |
       +- process_template(ppt, mapping_path, records_preloaded)  generators/template.py:675
            +- (see "Template Processor" below)
```

**Date range derivation** `pipeline/db.py:39`:
- Day == 1 -> previous full month
- Day < 6 -> previous-month-start -> today
- Otherwise -> current-month-start -> today

### 2. Excel → PPTX

Triggered by `POST /generate/excel` → `api.py:228`

```
api.py:228  generate_excel()
  |
  +- Upload file -> tempfile
  +- fetch_mapping(settings, app_id) -> dict
  |
  +- pipeline/excel.py:21  generate_for_excel_mapping()
       |
       +- AppMapping.from_dict(mapping)                  lib/data_processing/_mapping.py:57
       +- read_excel(excel_path, mapping)                lib/data_processing/_excel.py:57
       |    +- openpyxl (read_only, data_only)
       |    +- Build col_index from mapping.fields
       |    +- For each row:
       |    |    +- _parse_date() -> skip if invalid
       |    |    +- _parse_count() -> 0 if blank
       |    |    +- core_fields null check -> skip
       |    |    +- TransactionRecord(...)
       |    +- Returns records
       |
       +- Filter: ignore_errors, ignore_features (caller)  :33
       +- Filter: date_range                                :35
       +- Derive weekly_periods from mapping or auto        :61-81
       |
       +- process_template(ppt, mapping_path, records_preloaded)  generators/template.py:675
```

### 3. Synthetic → PPTX

Triggered by `POST /generate/synthetic` → `api.py:268`

```
api.py:268  generate_synthetic()
  |
  +- Load mapping JSON from data/others/{mapping_filename}
  +- Check template_synthetic_monitoring.pptx exists
  +- Upload CSV/XLSX -> tempfile
  |
  +- generators/synthetic.py:540  process_synthetic_template()
       |
       +- SyntheticAppMapping.from_file(mapping_path)     lib/data_processing/_synthetic.py:101
       +- read_synthetic_table(data_path, mapping)         lib/data_processing/_synthetic.py:254
       |    +- CSV -> _read_synthetic_csv() :434
       |    +- XLSX -> _read_synthetic_xlsx() :393
       |         +- openpyxl / csv
       |         +- _build_col_index() :273
       |         +- _row_to_record() :316 -> SyntheticRunRecord
       |         +- (handles run_id_fallback_column, trx_date, features_durations_ms_only)
       |
       +- Filter: date_range, ignore_errors, ignore_features, skipped_statuses  :553-570
       |
       +- KPIs & slides 1-4 (title, date, summary stats)
       +- Slides 5-11: feature charts (2 per slide)  :657-691
       +- Slides 12-13: per-action breakdown tables  :693-737
       +- Slide 14: top-10 failed features table    :739-749
```

---

## Template Processor — `generators/template.py:675`

Shared entry point for DB & Excel pathways. Same logic, different data sources.

### Steps

1. **Load mapping** `AppMapping.from_file(mapping_path)`  :683
2. **Get records** (preloaded or from xlsx with `read_excel`)  :684-689
3. **Ignore filter** — drop matching errors/features  :691-696
4. **Date filter** — apply `mapping.date_range`  :698
5. **Compute KPIs**:
   - `total_trx`, `success_trx`, `sr`, `system_error_trx`, `business_error_trx`
   - `trx_avg`, `h_trx_date`, `h_sr_date`, `l_sr_date`  :709-731
6. **Slide fills** (template.pptx placeholders):

| Slide | Placeholders Filled |
|-------|-------------------|
| 1 | `{{year}}` — year range of data |
| 2 | `{{title}}` — mapping name |
| 3 | `{{date_range}}` — auto-formatted range |
| 4 | `{{title}}`, `{{total_trx}}`, `{{sr}}`, `{{trx_avg}}`, `{{h_trx/h_sr/l_sr}}`, `img_daily_sr_trx`, `img_monthly_sr_trx` |
| 5-7 (SE) | `{{total_trx}}`, `{{total_error}}`, `{{title}}`, `img_diagram_se_be`, `img_chart_se_be`, `tbl_rc` |
| 8 (BE) | Same structure as SE slides |
| 9 (Trends) | `img_chart_se_trends`, `img_chart_be_trends`, `{{app_name}}` |

### Chart functions called

| Chart | Function | File:Line |
|-------|----------|-----------|
| Monthly trx + SR % | `_chart_monthly_sr_trx()` | `generators/template.py:44` |
| Daily trx + SR % | `_chart_daily_sr_trx()` | `generators/template.py:143` |
| Success/error stacked bar | `_chart_trx_breakdown()` | `generators/template.py:214` |
| BE%/SE% daily line | `_chart_errors_breakdown()` | `generators/template.py:408` |
| Top-5 error trends | `_chart_top_five_errors()` | `generators/template.py:523` |

### Table aggregation — `lib/report_helpers.py`

- `aggregate_by_period()` :83 -> counts by weekly period, keyed by `RC | feature`
- `get_table_pages()` :187 -> top-15 SE (paginated 3x5 = slides 5-7) + top-5 BE (slide 8)
- `table_aggregate_error_key()` :75 — composite key format

## Related Docs

- [Overview](/sr-generator/overview) — architecture, data models, config
- [API & Setup](/sr-generator/api) — endpoints, DB schema, mock mode, outputs
