# No RC Transaction Technical Notes

## Code Path Utama
- List no-RC: `src/app/api/no-rc-transaction/route.ts`
- Submit single: `src/app/api/no-rc-transaction/submit/route.ts`
- Submit batch: `src/app/api/no-rc-transaction/submit-batch/route.ts`

## Alur Eksekusi Submit Single (Code-Level)
1. Validasi `id` dan `rc`.
2. Begin transaction.
3. Update `app_success_rate`:
   - set `rc`, `rc_description`, `updated_at`.
4. Ambil `id_app_identifier` + `jenis_transaksi` dari row tersebut.
5. Lookup dictionary exact match:
   - jika ketemu -> set `error_type` di `app_success_rate`.
   - jika tidak -> upsert ke `unmapped_rc` (untuk tindak lanjut).
6. Commit dan tulis audit `NO_RC_TRANSACTION_SUBMITTED`.

## Titik Rawan Error
- Record id tidak ada -> `404`.
- RC diisi tapi tidak matching dictionary -> tetap null dan pindah ke `unmapped_rc`.
- Deadlock/rollback jika batch besar paralel.

## Checklist Troubleshooting
1. Cek row target sebelum submit (nilai `rc`, `error_type`).
2. Submit satu row lalu cek hasil:
   - apakah `error_type` langsung terisi?
   - jika tidak, apakah masuk `unmapped_rc`?
3. Jika behavior tidak sesuai:
   - cek exact key dictionary (`id_app_identifier`, `jenis_transaksi`, `rc`).
4. Cek audit trail untuk detail perubahan.

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
- [Technical Index](README.md)
- [Feature: No RC Transaction Handling](../features/no-rc-transaction.md)
- [Project README](../../README.md)
