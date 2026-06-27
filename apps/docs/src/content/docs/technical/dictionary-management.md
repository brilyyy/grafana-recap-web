---
title: Dictionary Management
description: Dictionary schema and implementation details.
---

## Main Code Path

- Upload dictionary: `src/routes/api/upload-dictionary.ts` (batch upsert, transactional)
- Update error type: tRPC `dictionary.updateErrorType` (`src/server/trpc/routers/dictionary.ts`)
- Update description: tRPC `dictionary.updateDescription` / `dictionary.updateDescriptionBatch`

## Upload Execution Flow (Code-Level)

1. Parse CSV/Excel file (`parseCSV` or `xlsx` parser).
2. Validate required headers: `Jenis Transaksi`, `RC`, `S/N` (+ optional `RC Description`).
3. Convert `S/N` -> `error_type`:
   - `S`, `N`, `Sukses`.
4. Upsert into `response_code_dictionary` using PostgreSQL `ON CONFLICT (...) DO UPDATE`.
5. Auto-remap:
   - scan `unmapped_rc` for same app
   - exact match `(id_app_identifier, jenis_transaksi, rc)`
   - update `app_success_rate.error_type`
   - delete `unmapped_rc` entries that were successfully mapped.

## Key SQL

- Composite unique key dictionary:
  - `(id_app_identifier, jenis_transaksi, rc)`
- Update remap target:
  - `app_success_rate` with exact match + specific status filter.

## Error-Prone Points

- Header mismatch (typo/case/missing columns).
- Invalid `S/N` value -> row skipped then upload fails (fail-fast).
- Invalid app ID.
- Empty transaction type data -> cannot perform exact remap.

## Checklist Troubleshooting

1. Ensure file matches expected column format.
2. If upload fails, inspect `skippedRows` in response payload.
3. If dictionary is populated but data not remapped:
   - check whether `jenis_transaksi` and `rc` exactly match.
4. Run manual update endpoint for a single entry to isolate the bug.

## Query Debug SQL

```sql
SELECT id, id_app_identifier, jenis_transaksi, rc, error_type, rc_description
FROM response_code_dictionary
WHERE id_app_identifier = 1
ORDER BY id DESC
LIMIT 50;

SELECT id, id_app_identifier, jenis_transaksi, rc, created_at
FROM unmapped_rc
WHERE id_app_identifier = 1
ORDER BY created_at DESC
LIMIT 50;
```

## Related Docs

- [Feature: Dictionary Management](/features/dictionary-management)
