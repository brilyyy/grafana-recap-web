# Unmapped RC Technical Notes

## Code Path Utama
- tRPC router: `src/server/trpc/routers/unmappedRc.ts`
- Submit single: `unmappedRc.submit`
- Submit batch: `unmappedRc.submitBatch`

## Alur Eksekusi Submit Single
1. Validasi payload `id`, `id_app_identifier`, `rc`, `error_type`.
2. Begin transaction.
3. Upsert dictionary (`response_code_dictionary`) via `rcDictUpsertSql`.
4. Update `app_success_rate.error_type` sesuai key:
   - jika `jenis_transaksi` ada -> exact key 3 kolom.
   - jika kosong -> fallback terbatas (`jenis_transaksi IS NULL/''`).
5. Delete row dari `unmapped_rc`.
6. Commit dan tulis audit `UNMAPPED_RC_SUBMITTED`.

## Titik Rawan Error
- Payload tidak lengkap -> `400`.
- `error_type` di luar `S|N|Sukses` -> `400`.
- Row `unmapped_rc` stale (sudah dihapus proses lain).
- Update count nol karena key tidak match.

## Checklist Troubleshooting
1. Ambil satu row `unmapped_rc` dari DB lalu submit manual via endpoint.
2. Cek `updatedRows` (di log/audit details) untuk memastikan backfill berjalan.
3. Jika dictionary sudah terisi tapi data masih null:
   - cek `jenis_transaksi` mismatch whitespace/case.
4. Pastikan commit sukses (tidak rollback).

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
- [Technical Index](README.md)
- [Feature: Unmapped RC Handling](../features/unmapped-rc.md)
- [Project README](../../README.md)
