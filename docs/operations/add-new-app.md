# Urutan Membuat Query untuk Aplikasi Baru

Panduan langkah demi langkah untuk menambahkan aplikasi baru ke Dashboard Grafana, termasuk success rate queries, raw table, stored procedures, dan deployment ke production.

---

## 1. Add New App melalui Frontend

Tambahkan aplikasi baru melalui **Superadmin > App Config** di frontend. Pastikan aplikasi tercatat di tabel `app_identifier` dengan konfigurasi:
- `app_name` – nama aplikasi (mis. Bale, CMS)
- `db_name` – database raw aplikasi (mis. `bale_db`, `cms_db`)
- `raw_table_name` – nama tabel raw (mis. `raw_bale`, `raw_cms`)

---

## 2. Add Query Success Rate dan Raw Table

### 2.1 Success Rate Queries

Buat folder baru di `scripts/success_rate/{app_key}/` dengan file:

| File | Deskripsi |
|------|-----------|
| `raw.postgres.sql` | Query agregasi untuk PostgreSQL (SELECT dari raw table) |
| `procedure.postgres.sql` | Stored procedure lengkap untuk PostgreSQL |

**Contoh struktur:**
```
scripts/success_rate/
├── bale/
│   ├── raw.postgres.sql
│   └── procedure.postgres.sql
└── {app_key_baru}/
    ├── raw.postgres.sql
    └── procedure.postgres.sql
```

Lihat [success-rate-sql.md](success-rate-sql.md) untuk detail struktur query dan stored procedure.

### 2.2 Raw Table Creation

Buat file DDL untuk raw table di `scripts/raw_table_creation/` untuk database raw aplikasi baru.

**Contoh:** `scripts/raw_table_creation/raw_{app_name}.sql`

```sql
-- CDC creates raw tables in {app_name}_db (e.g., bale_db), not in platform_db.
-- Create database first: CREATE DATABASE {app_name}_db;

CREATE TABLE public.raw_{app_name} (
    id SERIAL PRIMARY KEY,
    transaction_date TIMESTAMP NOT NULL,
    -- ... kolom sesuai kebutuhan aplikasi
);
```

Jalankan DDL ini di database `{app_name}_db` (atau sesuai konfigurasi CDC) sebelum migration.

---

## 3. Add Stored Procedures

1. **Daftarkan aplikasi** di `scripts/success_rate/registry.ts`:
   ```ts
   export const PROCEDURE_APPS: ProcedureApp[] = [
     { appKey: 'bale', procedureName: 'sp_process_bale_daily' },
     { appKey: 'bale_bisnis', procedureName: 'sp_process_bale_bisnis_daily' },
     { appKey: '{app_key_baru}', procedureName: 'sp_process_{app_key}_daily' },  // tambahkan baris ini
   ]
   ```

2. Pastikan file `procedure.postgres.sql` sudah ada di folder `scripts/success_rate/{app_key}/`.

3. Migration akan otomatis memuat dan menjalankan stored procedure dari file tersebut.

---

## 4. Update Scheduler

Stored procedure perlu dijadwalkan agar berjalan otomatis (mis. setiap hari jam 00:01).
Scheduler berjalan di level aplikasi (node-cron, selalu aktif) — pg_cron sudah dihapus.

### 4.1 `src/lib/scheduler.ts`

Tambahkan satu entry ke tabel `RECAP_JOBS`:

```ts
{ name: '{App} processing', envVar: '{APP_KEY}_PROCESSING_SCHEDULE', procedure: 'sp_process_{app_key}_daily' },
```

Tidak ada kode lain yang perlu diubah — loop scheduler membaca tabel ini.
Setelah update, rebuild dan redeploy aplikasi agar job baru aktif.

### 4.2 Environment Variables

Tambahkan ke `src/env.ts` (schema, dengan default `'1 0 * * *'`) dan `.env`:
```
{APP_KEY}_PROCESSING_SCHEDULE=1 0 * * *
```

---

## 5. Jalankan Migration

Dari root project (env `.env` berisi koneksi `platform_db`):

```bash
pnpm db:migrate              # semua fase: schema, procedures, seed, FDW
```

**Per fase (opsional):**
- `pnpm db:migrate:schema` – schema + BetterAuth + processing log + index
- `pnpm db:migrate:procedures` – stored procedure saja
- `pnpm db:migrate:seed` – seed superadmin
- `pnpm db:migrate:fdw` – FDW servers, user mappings, foreign tables

---

## Ringkasan Checklist

| # | Langkah | Lokasi |
|---|---------|--------|
| 1 | Add new app via frontend | Superadmin > App Config |
| 2a | Success rate queries (PostgreSQL) | `scripts/success_rate/{app_key}/` |
| 2b | Raw table DDL (PostgreSQL) | `scripts/raw_table_creation/` |
| 3 | Stored procedures + registry | `scripts/success_rate/{app_key}/` + `registry.ts` |
| 4 | Tambah entry `RECAP_JOBS` + env schedule | `src/lib/scheduler.ts`, `src/env.ts` |
| 5 | Run migration | `pnpm db:migrate` |

---

## Langkah yang Tidak Perlu Diubah

- **Manual trigger** — tRPC `recap.triggerManual` / `processingLogs.processManual` sudah generic; memanggil `sp_process_{app_key}_daily` berdasarkan catalog/app. Tidak perlu endpoint baru per app.
- **`app_identifier` seed** — app baru cukup ditambah via frontend (langkah 1).
