---
title: Unmapped RC
description: Unmapped RC internals.
---

## Main Code Path

- tRPC router: `src/server/trpc/routers/unmappedRc.ts`
- Submit single: `unmappedRc.submit`
- Submit batch: `unmappedRc.submitBatch`

## Submit Single Execution Flow

1. Validate payload `id`, `id_app_identifier`, `rc`, `error_type`.
2. Begin transaction.
3. Upsert dictionary (`response_code_dictionary`) via `rcDictUpsertSql`.
4. Update `app_success_rate.error_type` by key:
   - if `jenis_transaksi` is present -> exact 3-column key.
   - if empty -> limited fallback (`jenis_transaksi IS NULL/''`).
5. Delete row from `unmapped_rc`.
6. Commit and write audit `UNMAPPED_RC_SUBMITTED`.

## Error-Prone Points

- Incomplete payload -> `400`.
- `error_type` outside `S|N|Sukses` -> `400`.
- Stale `unmapped_rc` row (already deleted by another process).
- Update count zero because key does not match.

## Checklist Troubleshooting

1. Fetch one `unmapped_rc` row from DB then submit manually via endpoint.
2. Check `updatedRows` (in log/audit details) to confirm backfill ran.
3. If dictionary is populated but data is still null:
   - check `jenis_transaksi` for whitespace/case mismatch.
4. Confirm commit succeeded (no rollback).

## Query Debug SQL

```sql
SELECT id, id_app_identifier, jenis_transaksi, rc, created_at
FROM unmapped_rc
ORDER BY id DESC
LIMIT 50;

SELECT id, id_app_identifier, jenis_transaksi, rc, error_type, updated_at
FROM app_success_rate
WHERE rc = '00'
ORDER BY updated_at DESC
LIMIT 50;
```

## Related Docs

- [Feature: Unmapped RC](/features/unmapped-rc)
