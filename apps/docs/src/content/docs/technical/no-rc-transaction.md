---
title: No-RC Transaction
description: No-RC transaction implementation details.
---

## Main Code Path

- tRPC router: `src/server/trpc/routers/noRcTransaction.ts`
- Submit single: `noRcTransaction.submit`
- Submit batch: `noRcTransaction.submitBatch`

## Submit Single Execution Flow (Code-Level)

1. Validate `id` and `rc`.
2. Begin transaction.
3. Update `app_success_rate`:
   - set `rc`, `rc_description`, `updated_at`.
4. Get `id_app_identifier` + `jenis_transaksi` from the row.
5. Lookup dictionary exact match:
   - if found -> set `error_type` in `app_success_rate`.
   - if not -> upsert into `unmapped_rc` (for follow-up).
6. Commit and write audit `NO_RC_TRANSACTION_SUBMITTED`.

## Error-Prone Points

- Record id not found -> `404`.
- RC filled but not matching dictionary -> stays null and moves to `unmapped_rc`.
- Deadlock/rollback if large parallel batch.

## Checklist Troubleshooting

1. Check target row before submit (`rc`, `error_type` values).
2. Submit one row then check result:
   - is `error_type` filled immediately?
   - if not, did it go to `unmapped_rc`?
3. If behavior is unexpected:
   - check exact dictionary key (`id_app_identifier`, `jenis_transaksi`, `rc`).
4. Check audit trail for change details.

## Query Debug SQL

```sql
SELECT id, id_app_identifier, jenis_transaksi, rc, rc_description, error_type, updated_at
FROM app_success_rate
WHERE id = 123;

SELECT id, id_app_identifier, jenis_transaksi, rc, rc_description, status_transaksi
FROM unmapped_rc
WHERE id_app_identifier = 1
ORDER BY id DESC
LIMIT 20;
```

## Related Docs

- [Feature: No-RC Transaction](/features/no-rc-transaction)
