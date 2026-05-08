# Dictionary Management Technical Notes

## Code Path Utama
- Upload dictionary: `src/app/api/upload-dictionary/route.ts`
- Update error type: `src/app/api/dictionary/update/route.ts`
- Update description: `src/app/api/dictionary/update-description/route.ts`

## Alur Eksekusi Upload (Code-Level)
1. Parse file CSV/Excel (`parseCSV` atau `xlsx` parser).
2. Validasi header wajib: `Jenis Transaksi`, `RC`, `S/N` (+ optional `RC Description`).
3. Konversi `S/N` -> `error_type`:
   - `S`, `N`, `Sukses`.
4. Upsert ke `response_code_dictionary` pakai SQL berbeda:
   - PostgreSQL: `ON CONFLICT (...) DO UPDATE`
   - MySQL: `ON DUPLICATE KEY UPDATE`.
5. Auto-remap:
   - scan `unmapped_rc` untuk app sama
   - exact match `(id_app_identifier, jenis_transaksi, rc)`
   - update `app_success_rate.error_type`
   - delete `unmapped_rc` yang berhasil ter-map.

## SQL Kunci
- Composite unique key dictionary:
  - `(id_app_identifier, jenis_transaksi, rc)`
- Update remap target:
  - `app_success_rate` dengan kondisi exact match + status filter khusus.

## Titik Rawan Error
- Header tidak sesuai (typo/case/kolom kurang).
- Nilai `S/N` tidak valid -> row di-skip lalu upload di-fail (fail-fast).
- App ID tidak valid.
- Data jenis transaksi kosong -> tidak bisa exact remap.

## Checklist Troubleshooting
1. Pastikan file sesuai format kolom.
2. Jika upload gagal, periksa payload `skippedRows` pada response.
3. Jika dictionary masuk tapi data belum ter-remap:
   - cek apakah `jenis_transaksi` dan `rc` exact match.
4. Jalankan update manual endpoint untuk satu entry guna isolasi bug.

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
- [Technical Index](README.md)
- [Feature: Dictionary Management](../features/dictionary-management.md)
- [Project README](../../README.md)
