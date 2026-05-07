# Application Management Technical Notes

## Code Path Utama
- API: `src/app/api/applications/route.ts`
- Migration schema table: `src/db/migrate.ts` (Phase 1: `app_identifier`)

## Kolom Penting `app_identifier`
- `app_name`: nama aplikasi (unik).
- `db_name`: nama database sumber raw (untuk FDW/cross-db).
- `raw_table_name`: nama tabel raw utama.

## Alur Eksekusi (POST /api/applications)
1. Validasi `appName`.
2. Generate otomatis:
   - `db_name = {normalized}_db`
   - `raw_table_name = raw_{normalized}`.
3. Insert ke `app_identifier`.
4. Handle duplicate key:
   - MySQL: `ER_DUP_ENTRY/1062`
   - PostgreSQL: `23505`.

## Titik Rawan Error
- `appName` kosong -> `400`.
- Nama app duplikat -> `400 Application name already exists`.
- Data config app belum lengkap (`db_name`/`raw_table_name`) menyebabkan proses FDW/processing gagal.

## Checklist Troubleshooting
1. Cek app list (`GET /api/applications`).
2. Cek data config app (`db_name`, `raw_table_name`).
3. Jika proses upload/processing gagal untuk app tertentu:
   - verifikasi `id_app_identifier` valid
   - verifikasi mapping app config di DB.

## Query Debug SQL
```sql
SELECT id, app_name, db_name, raw_table_name, retention_days
FROM app_identifier
ORDER BY app_name;
```

## Related Docs
- [Technical Index](README.md)
- [Feature: Application Management](../features/app-management.md)
- [Project README](../../README.md)
