# Urutan Membuat Query untuk Aplikasi Baru

Panduan langkah demi langkah untuk menambahkan aplikasi baru ke Dashboard Grafana, termasuk success rate queries, raw table, stored procedures, dan deployment ke production.

---

## 1. Add New App melalui Frontend

Tambahkan aplikasi baru melalui **Superadmin > App Config** di frontend. Pastikan aplikasi tercatat di tabel `app_identifier` dengan konfigurasi:
- `app_name` – nama aplikasi (mis. Bale, CMS)
- `db_name` – database raw aplikasi (mis. `db_bale`, `db_cms`)
- `raw_table_name` – nama tabel raw (mis. `raw_bale`, `raw_cms`)

---

## 2. Add Query Success Rate dan Raw Table

### 2.1 Success Rate Queries

Buat folder baru di `scripts/success_rate/{app_key}/` dengan file:

| File | Deskripsi |
|------|-----------|
| `raw.mysql.sql` | Query agregasi untuk MySQL (SELECT dari raw table) |
| `raw.postgres.sql` | Query agregasi untuk PostgreSQL (SELECT dari raw table) |
| `procedure.mysql.sql` | Stored procedure lengkap untuk MySQL |
| `procedure.postgres.sql` | Stored procedure lengkap untuk PostgreSQL |

**Contoh struktur:**
```
scripts/success_rate/
├── bale/
│   ├── raw.mysql.sql
│   ├── raw.postgres.sql
│   ├── procedure.mysql.sql
│   └── procedure.postgres.sql
└── {app_key_baru}/
    ├── raw.mysql.sql
    ├── raw.postgres.sql
    ├── procedure.mysql.sql
    └── procedure.postgres.sql
```

Lihat `scripts/success_rate/README.md` untuk detail struktur query dan stored procedure.

### 2.2 Raw Table Creation

Buat file DDL untuk raw table di `scripts/raw_table_creation/` untuk database raw aplikasi baru. Sertakan definisi untuk **MySQL** dan **PostgreSQL**.

**Contoh:** `scripts/raw_table_creation/raw_{app_name}.sql`

```sql
-- CDC creates raw tables in db_{app_name} (e.g., db_bale), not in platform_db.
-- Create database first: CREATE DATABASE db_{app_name};

-- POSTGRES
CREATE TABLE public.raw_{app_name} (
    id SERIAL PRIMARY KEY,
    transaction_date TIMESTAMP NOT NULL,
    -- ... kolom sesuai kebutuhan aplikasi
);

-- MYSQL (run in db_{app_name} database)
CREATE TABLE raw_{app_name} (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    transaction_date DATETIME NOT NULL,
    -- ... kolom sesuai kebutuhan aplikasi
);
```

Jalankan DDL ini di database `db_{app_name}` (atau sesuai konfigurasi CDC) sebelum migration.

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

2. Pastikan file `procedure.mysql.sql` dan `procedure.postgres.sql` sudah ada di folder `scripts/success_rate/{app_key}/`.

3. Migration akan otomatis memuat dan menjalankan stored procedure dari file tersebut.

---

## 4. Re-copy Migration-Kit ke Production Server

Setelah menambah atau mengubah migration (termasuk stored procedures), salin ulang folder `migration-kit` ke server production:

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

## 5. Setup .env untuk Migration-Kit

Di server production, konfigurasi `.env` di dalam folder migration-kit:

```bash
cd /app/migration-kit
cp .env.example .env
# Edit .env
```

**Variabel penting untuk DB_NAME:**
- `DB_NAME=platform_db` – untuk menjalankan migration schema, procedures, dan FDW ke database platform
- `DB_NAME=postgres` – untuk mendaftarkan job pg_cron (jika menggunakan PostgreSQL dengan pg_cron)

**PostgreSQL:** Jika memakai pg_cron, jalankan migration dua kali:
1. Ke `platform_db` – membuat table, procedure, FDW
2. Ke `postgres` – mendaftarkan job cron

**MySQL:** `DB_NAME` cukup mengarah ke database platform (mis. `platform_db`).

---

## 6. Jalankan Migration untuk Cron

Di root project migration-kit:

```bash
cd /app/migration-kit
npm run migrate
```

Ini menjalankan semua fase: schema, procedures, cron/events, seed, dan (PostgreSQL) FDW.

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
- `npm run migrate:fdw` – (PostgreSQL only) FDW servers, user mappings, foreign tables

---

## Ringkasan Checklist

| # | Langkah | Lokasi |
|---|---------|--------|
| 1 | Add new app via frontend | Superadmin > App Config |
| 2a | Success rate queries (MySQL + PostgreSQL) | `scripts/success_rate/{app_key}/` |
| 2b | Raw table DDL (MySQL + PostgreSQL) | `scripts/raw_table_creation/` |
| 3 | Stored procedures + registry | `scripts/success_rate/{app_key}/` + `registry.ts` |
| 4 | Re-copy migration-kit | Ke server production |
| 5 | Setup .env (DB_NAME) | `migration-kit/.env` |
| 6 | Run migration | `cd migration-kit && npm run migrate` |
