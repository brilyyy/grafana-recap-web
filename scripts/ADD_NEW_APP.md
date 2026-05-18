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

Lihat `scripts/success_rate/README.md` untuk detail struktur query dan stored procedure.

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

## 4. Update Scheduler dan Cron Setup

Stored procedure perlu dijadwalkan agar berjalan otomatis (mis. setiap hari jam 00:01). Ada dua mekanisme yang perlu di-update:

### 4.1 `src/lib/scheduler.ts` (Application-Level Scheduler)

**Untuk apa?** Digunakan ketika `USE_APP_LEVEL_SCHEDULER=true` — biasanya untuk **PostgreSQL di Windows** yang tidak punya pg_cron. Scheduler ini memakai **node-cron** di dalam aplikasi Next.js untuk memanggil stored procedure sesuai jadwal.

**Yang perlu di-update:**
1. Tambah variabel task (mis. `cmsProcessingTask`)
2. Tambah fungsi execute (mis. `executeCmsProcessing()`) yang memanggil `sp_process_{app_key}_daily`
3. Tambah blok di `setupProcessingSchedulers()` untuk mendaftarkan job node-cron
4. Tambah ke `stopScheduler()` untuk membersihkan task saat shutdown
5. Tambah env var: `{APP_KEY}_PROCESSING_SCHEDULE` (mis. `CMS_PROCESSING_SCHEDULE=1 0 * * *`)

**Contoh pola** (ikuti struktur Bale/Bale Bisnis yang sudah ada).

> **Catatan:** Perubahan `scheduler.ts` memengaruhi **aplikasi Next.js utama**. Setelah di-update, lakukan **rebuild dan redeploy** aplikasi production agar scheduler baru aktif. Migration-kit tidak berisi scheduler — hanya untuk menjalankan migration.

### 4.2 `src/db/migrate.ts` (Database Scheduler - pg_cron)

**Untuk apa?** Migration Phase 6 membuat job cron di database menggunakan pg_cron. Job cron otomatis diambil dari `registry.ts` — **tidak perlu edit migrate.ts**. Cukup tambah ke registry dan jalankan migration.

### 4.3 Environment Variables

Tambahkan ke `src/env.ts` (schema) dan `.env.example`:
```
{APP_KEY}_PROCESSING_SCHEDULE=1 0 * * *
```

Contoh: `CMS_PROCESSING_SCHEDULE=1 0 * * *`

---

## 5. Re-copy Migration-Kit ke Production Server

Setelah menambah atau mengubah migration (termasuk stored procedures dan cron setup), salin ulang folder `migration-kit` ke server production:

```bash
# Dari mesin build (dengan akses internet)
cd migration-kit
npm install   # atau npm ci
# Pastikan src/db/migrate.ts sudah sinkron dengan project utama

# Copy ke server production (sesuaikan dengan metode deploy Anda)
scp -r ./migration-kit user@prod-server:/app/
```

Pastikan `src/db/migrate.ts` di migration-kit sama dengan `src/db/migrate.ts` di project utama.

---

## 6. Setup .env untuk Migration-Kit

Di server production, konfigurasi `.env` di dalam folder migration-kit:

```bash
cd /app/migration-kit
cp .env.example .env
# Edit .env
```

**Variabel penting untuk DB_NAME:**
- `DB_NAME=platform_db` – untuk menjalankan migration schema, procedures, dan FDW ke database platform
- `DB_NAME=postgres` – untuk mendaftarkan job pg_cron

**PostgreSQL:** Jika memakai pg_cron, jalankan migration dua kali:
1. Ke `platform_db` – membuat table, procedure, FDW
2. Ke `postgres` – mendaftarkan job cron

---

## 7. Jalankan Migration untuk Cron

Di root project migration-kit:

```bash
cd /app/migration-kit
npm run migrate
```

Ini menjalankan semua fase: schema, procedures, cron/events, seed, dan FDW.

**PostgreSQL dengan pg_cron – urutan eksekusi:**
```bash
# 1. Migration ke platform database (table + procedure + FDW)
DB_NAME=platform_db DB_TYPE=postgresql npm run migrate

# 2. Migration ke database postgres (daftar job pg_cron)
DB_NAME=postgres DB_TYPE=postgresql npm run migrate
```

**Per fase (opsional):**
- `npm run migrate:schema` – schema + BetterAuth + processing log + index
- `npm run migrate:procedures` – stored procedure saja
- `npm run migrate:cron` – cron/event scheduler
- `npm run migrate:seed` – seed app identifier + superadmin
- `npm run migrate:fdw` – FDW servers, user mappings, foreign tables

---

## Ringkasan Checklist

| # | Langkah | Lokasi |
|---|---------|--------|
| 1 | Add new app via frontend | Superadmin > App Config |
| 2a | Success rate queries (PostgreSQL) | `scripts/success_rate/{app_key}/` |
| 2b | Raw table DDL (PostgreSQL) | `scripts/raw_table_creation/` |
| 3 | Stored procedures + registry | `scripts/success_rate/{app_key}/` + `registry.ts` |
| 4 | Update scheduler (jika USE_APP_LEVEL_SCHEDULER) atau env schedule | `src/lib/scheduler.ts` (opsional), `{APP_KEY}_PROCESSING_SCHEDULE` di .env |
| 5 | Re-copy migration-kit | Ke server production |
| 6 | Setup .env (DB_NAME, schedule) | `migration-kit/.env` |
| 7 | Run migration | `cd migration-kit && npm run migrate` |

---

## Langkah yang Tidak Perlu Diubah

- **`/api/processing/process-manual`** — Endpoint manual trigger sudah generic; memanggil `sp_process_{app_key}_daily` berdasarkan `app_name` dari body. Tidak perlu endpoint baru per app.
- **`app_identifier` seed** — Migration Phase 7 sudah menyertakan daftar default apps (Bale, Bale Bisnis, CMS, dll.). Jika app baru ada di daftar, akan ter-seed otomatis. Jika tidak, cukup tambah via frontend (langkah 1).
