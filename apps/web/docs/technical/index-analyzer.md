# Index Analyzer Technical Notes

## Code Path Utama
- tRPC router: `src/server/trpc/routers/indexAnalyzer.ts` (`indexAnalyzer.analyze`, `superAdminProcedure`, query only — no DDL executed).
- Source-of-truth scan: `scanSqlObjects()` di `src/db/sql-loader.ts` — regex-parse seluruh file di `src/db/sql/{01_schema,02_indexes,03_procedures,06_cron}/` untuk daftar table/enum/function/index yang "seharusnya" ada.
- UI: `src/routes/_dashboard/superadmin/index-analyzer.tsx`.

## Alur Eksekusi `analyze`
Lima query dijalankan paralel (`Promise.all`), semua read-only terhadap katalog Postgres:

1. **Unused** — `pg_stat_user_indexes` dengan `idx_scan = 0`, bukan unique/primary key. Rekomendasi: `DROP INDEX IF EXISTS`.
2. **Missing** — `pg_stat_user_tables` dengan `seq_scan > 0`, `idx_scan <= seq_scan`, `n_live_tup > 1000`. Top 50 by `seq_scan`. Rekomendasi: review kolom WHERE/JOIN yang sering dipakai.
3. **Sizes** — `pg_stat_user_tables` + `pg_total_relation_size`/`pg_relation_size`/`pg_indexes_size`. Top 50 by total size. `deadPct = n_dead_tup / n_live_tup`; rekomendasi `VACUUM (ANALYZE)` muncul jika `deadPct >= 20`.
4. **Redundant** — ambil seluruh index + ordered column list (`indexColumns()`), lalu `findRedundant()`: index non-unique dianggap redundant jika column list-nya adalah leading prefix dari index lain pada tabel yang sama.
5. **Drift** — bandingkan `pg_indexes` (live) vs `scanSqlObjects().indexes` (expected dari `src/db/sql/02_indexes`):
   - Expected tapi tidak ada di DB → status `missing` (jalankan ulang fase Schema).
   - Ada di DB tapi tidak ada di source, dan bukan index hasil constraint (`_pkey`, `_key`, `_grain_key`, `unique_dictionary_entry`) → status `extra` (informational — tambahkan ke source atau drop).

Response dibungkus jadi satu `IndexAnalyzerReport` (`unused`, `missing`, `sizes`, `redundant`, `drift`, `summary` counts, `dbName`).

## Titik Rawan Error
- `dbName` diambil dari `process.env.DB_NAME` — kosong/"unknown" jika env tidak ter-set, tidak memengaruhi hasil analisis.
- Regex `scanSqlObjects()` bergantung pada gaya penulisan SQL standar (`CREATE INDEX ... ON "table"`) — index yang dibuat lewat sintaks non-standar (mis. di dalam DO block) tidak akan terdeteksi sebagai "expected", bisa salah muncul sebagai drift `extra`.
- Semua rekomendasi adalah **teks SQL untuk disalin manual** — analyzer tidak pernah mengeksekusi `DROP`/`VACUUM` sendiri.

## Checklist Troubleshooting
1. Halaman kosong/error → cek `query.error.message` (biasanya koneksi DB atau permission `pg_stat_*`).
2. Index muncul di "drift: extra" padahal sudah ada di source → cek apakah file index ada di `src/db/sql/02_indexes/` (bukan di `01_schema/` atau `03_procedures/` — hanya 4 direktori itu yang di-scan) dan namanya match persis (case-sensitive setelah lower-case regex).
3. "Missing" / "Unused" tidak update setelah `VACUUM`/`DROP` manual → klik **Rerun**, statistik `pg_stat_*` perlu di-refresh oleh planner/autovacuum.

## Query Debug SQL
```sql
SELECT relname, idx_scan, pg_size_pretty(pg_relation_size(indexrelid))
FROM pg_stat_user_indexes
WHERE schemaname = 'public' AND idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;
```

## Related Docs
- [Technical Index](README.md)
- [Feature: Index Analyzer](../features/index-analyzer.md)
- [Success Rate SQL README](../operations/success-rate-sql.md)
- [Project README](../../README.md)
