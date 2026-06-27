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

Satu file `.sql` per app — tidak ada folder/registry terpisah:

| File | Deskripsi |
|------|-----------|
| `src/db/sql/03_procedures/success_rate/{app_key}.sql` | Stored procedure lengkap, dengan blok `/* @meta ... @endmeta */` frontmatter di atas `CREATE OR REPLACE FUNCTION` |
| `src/db/sql/reference/success_rate/{app_key}.raw.sql` | Query referensi (SELECT dari raw table) — tidak auto-dijalankan, untuk dokumentasi/preview saja |

**Contoh struktur:**
```
src/db/sql/03_procedures/success_rate/
├── bale.sql
└── {app_key_baru}.sql
src/db/sql/reference/success_rate/
├── bale.raw.sql
└── {app_key_baru}.raw.sql
```

`{app_key}.sql` wajib diawali blok meta seperti ini (lihat `bale.sql` sbg contoh):
```sql
/* @meta
id: sr:{app_key}
recap_kind: success_rate_daily
title: {App} — success rate (daily)
output_table: app_success_rate
function_name: sp_process_{app_key}_daily
scope_type: per_app
app_key: {app_key}
raw_sql_repo_path: src/db/sql/reference/success_rate/{app_key}.raw.sql
description: H-1 recap of transaction success metrics into app_success_rate for {App}.
@endmeta */
CREATE OR REPLACE FUNCTION public.sp_process_{app_key}_daily(p_processing_date DATE DEFAULT NULL)
RETURNS void AS $$ ... $$ LANGUAGE plpgsql;
```

`@meta` diparse oleh `src/db/sql-loader.ts` (`parseSqlMeta`) dan otomatis masuk ke recap catalog (`buildRecapCatalog()` di `src/lib/domain/recap/catalog.ts`) — tidak perlu registrasi manual di tempat lain.

Lihat [success-rate-sql.md](success-rate-sql.md) untuk detail struktur query dan stored procedure.

### 2.2 Raw Table Creation

Buat file DDL referensi untuk raw table di `src/db/sql/reference/raw_table_creation/` untuk database raw aplikasi baru. File ini juga tidak auto-dijalankan — jalankan manual di database raw sebelum migration.

**Contoh:** `src/db/sql/reference/raw_table_creation/raw_{app_name}.sql`

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

1. Tulis `CREATE OR REPLACE FUNCTION` beserta blok `/* @meta ... @endmeta */` di file `src/db/sql/03_procedures/success_rate/{app_key}.sql` (lihat app lain, mis. `bale.sql`, sbg contoh).
2. Tidak ada registry untuk didaftarkan — file `.sql` ini otomatis terbaca oleh `parseSqlMeta()` / catalog saat migration berjalan (`pnpm db:migrate` atau `pnpm db:migrate:procedures`).
3. **Alternatif tanpa redeploy:** procedure ad-hoc juga bisa diregistrasi langsung lewat **Superadmin > App Config > {App} > Procedures**, paste SQL function-nya (function name harus match `sp_[a-z0-9_]{2,55}`) — langsung aktif di DB tanpa commit file/migration. Untuk app permanen tetap disarankan commit ke `src/db/sql/` agar ikut tracked di repo dan survive fresh install.

---

## 4. Update Scheduler

Stored procedure perlu dijadwalkan agar berjalan otomatis (mis. setiap hari jam 00:01).
Scheduler 100% DB-driven lewat tabel `scheduler_jobs`, dieksekusi oleh proses worker terpisah (`src/workers/scheduler-worker.ts`, di-fork dari `src/server.ts`). Tidak ada lagi env var per-app atau `src/lib/scheduler.ts` (file itu sudah tidak dipakai).

### 4.1 Cara cepat — tanpa redeploy

**Superadmin > Scheduler > Add Job** — isi nama job, procedure (`sp_process_{app_key}_daily`), dan cron schedule. Worker restart otomatis begitu job dibuat/diupdate, job langsung aktif.

### 4.2 Cara permanen — ikut ter-seed di instalasi baru

Tambahkan satu entry ke `SEED_JOBS` di `src/db/seed-schedules.ts`:

```ts
{ name: '{App} processing', procedure: 'sp_process_{app_key}_daily', defaultSchedule: '1 0 * * *' },
```

Idempotent (`ON CONFLICT ("procedure") DO NOTHING`) — jalankan `pnpm db:seed-schedules` untuk apply ke DB existing, atau biarkan ter-apply otomatis lewat `pnpm db:migrate` (fase cron).

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
| 2a | Success rate procedure + `@meta` | `src/db/sql/03_procedures/success_rate/{app_key}.sql` |
| 2b | Raw table DDL (referensi) | `src/db/sql/reference/raw_table_creation/` |
| 3 | (opsional) Procedure ad-hoc tanpa redeploy | Superadmin > App Config > Procedures |
| 4 | Scheduler job (live) atau `SEED_JOBS` (permanen) | Superadmin > Scheduler, `src/db/seed-schedules.ts` |
| 5 | Run migration | `pnpm db:migrate` |

---

## Langkah yang Tidak Perlu Diubah

- **Manual trigger** — tRPC `recap.triggerManual` / `processingLogs.processManual` sudah generic; memanggil `sp_process_{app_key}_daily` berdasarkan catalog/app. Tidak perlu endpoint baru per app.
- **`app_identifier` seed** — app baru cukup ditambah via frontend (langkah 1).
