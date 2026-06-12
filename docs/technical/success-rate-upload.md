# Success Rate Upload Technical Notes

## Code Path Utama
- Endpoint upload: `src/routes/api/upload-success-rate.ts` (file parsing via `src/lib/file-parser.ts`)
- Mapping dictionary: tabel `response_code_dictionary`
- Tujuan final: tabel `app_success_rate`
- Fallback unresolved: tabel `unmapped_rc`

## Alur Eksekusi (Code-Level)
1. Auth wajib: `requireAuth(request)`.
2. Ambil multipart field:
   - `successRateFile`
   - `selectedApplicationId`.
3. Parse file:
   - CSV via `parseCSV()`
   - Excel via `xlsx`.
4. Validasi row:
   - tanggal valid (`DD/MM/YYYY` atau `YYYY-MM-DD`)
   - `Jenis Transaksi` wajib
   - jika ada row invalid -> upload langsung gagal (fail-fast).
5. Rule RC:
   - RC kosong/null/"-" + indikasi sukses (`RC Description`/`Status Transaksi`) => RC `00`.
6. Mulai transaction DB:
   - exact lookup dictionary `(app_id, jenis_transaksi, rc)`
   - jika tidak ada => insert `unmapped_rc`
   - insert semua row ke `app_success_rate`
   - commit/rollback.

## Rule Kritis
- Tidak ada fallback lookup by RC saja.
- Exact match wajib untuk menjaga akurasi antar jenis transaksi.
- `error_type` bisa `NULL` untuk no-RC / unmapped scenario.

## Titik Rawan Error
- Kesalahan format tanggal (paling sering).
- Header file tidak sesuai.
- App ID tidak ditemukan (`Selected application does not exist`).
- `skippedRows` > 0 -> seluruh upload dibatalkan.

## Checklist Troubleshooting
1. Cek response error upload:
   - lihat `skippedRows` detail row dan alasan.
2. Jika upload sukses tapi data tidak muncul benar:
   - cek nilai `jenis_transaksi`, `rc`, `error_type` di `app_success_rate`.
3. Jika terlalu banyak unmapped:
   - cek dictionary exact-match.
4. Validasi audit event `SUCCESS_RATE_UPLOADED`.

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
- [Technical Index](README.md)
- [Feature: Success Rate Upload](../features/success-rate-upload.md)
- [Success Rate SQL README](../operations/success-rate-sql.md)
- [Project README](../../README.md)
