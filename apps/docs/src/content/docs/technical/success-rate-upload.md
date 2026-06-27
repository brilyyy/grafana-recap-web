---
title: Success Rate Upload
description: SR upload implementation details.
---

## Main Code Path

- Upload endpoint: `src/routes/api/upload-success-rate.ts` (file parsing via `src/lib/file-parser.ts`)
- Mapping dictionary: `response_code_dictionary` table
- Final destination: `app_success_rate` table
- Fallback unresolved: `unmapped_rc` table

## Execution Flow (Code-Level)

1. Auth required: `requireAuth(request)`.
2. Get multipart fields:
   - `successRateFile`
   - `selectedApplicationId`.
3. Parse file:
   - CSV via `parseCSV()`
   - Excel via `xlsx`.
4. Validate rows:
   - valid date (`DD/MM/YYYY` or `YYYY-MM-DD`)
   - `Jenis Transaksi` required
   - if any row is invalid -> upload fails immediately (fail-fast).
5. RC rule:
   - empty/null/"-" RC + success indication (`RC Description`/`Status Transaksi`) => RC `00`.
6. Begin DB transaction:
   - exact dictionary lookup `(app_id, jenis_transaksi, rc)`
   - if not found => insert `unmapped_rc`
   - insert all rows into `app_success_rate`
   - commit/rollback.

## Critical Rules

- No fallback lookup by RC alone.
- Exact match required to maintain accuracy across transaction types.
- `error_type` can be `NULL` for no-RC / unmapped scenarios.

## Error-Prone Points

- Date format errors (most common).
- File header mismatch.
- App ID not found (`Selected application does not exist`).
- `skippedRows` > 0 -> entire upload cancelled.

## Checklist Troubleshooting

1. Check upload error response:
   - inspect `skippedRows` detail for row and reason.
2. If upload succeeds but data looks wrong:
   - check `jenis_transaksi`, `rc`, `error_type` values in `app_success_rate`.
3. If too many unmapped:
   - check exact-match dictionary.
4. Validate `SUCCESS_RATE_UPLOADED` audit event.

## Query Debug SQL

```sql
SELECT id, id_app_identifier, tanggal_transaksi, jenis_transaksi, rc, error_type, created_at
FROM app_success_rate
WHERE id_app_identifier = 1
ORDER BY id DESC
LIMIT 100;

SELECT id, id_app_identifier, jenis_transaksi, rc, rc_description, status_transaksi, created_at
FROM unmapped_rc
WHERE id_app_identifier = 1
ORDER BY id DESC
LIMIT 100;
```

## Related Docs

- [Feature: Success Rate Upload](/features/success-rate-upload)
- [Operations: Success Rate SQL](/operations/success-rate-sql)
