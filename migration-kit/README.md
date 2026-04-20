# Migration Kit

Folder ini berisi script dan dependency untuk menjalankan migration database **di server production**, terpisah dari deploy aplikasi Next.js (standalone).

## Isi

- `package.json` – dependency (dotenv, bcryptjs, pg, mysql2, tsx, typescript) dan script migration
- `tsconfig.json` – konfigurasi TypeScript untuk menjalankan `src/db/migrate.ts`
- `src/db/migrate.ts` – script migration lengkap (salinan dari project utama)
- `scripts/success_rate/` – stored procedure SQL per aplikasi (`procedure.mysql.sql` / `procedure.postgres.sql` untuk bale, bale_bisnis, olob, cms, bale_korpora; PostgreSQL-only untuk edc_agen, edc_merchant, edc_merchant_ancol). File ini disalin dari project utama dan di-commit di folder ini; saat procedure diubah di repo utama, salin ulang file yang bersangkutan ke `migration-kit/scripts/success_rate/{app}/` sebelum deploy.
- `.env.example` – contoh variabel environment yang dibutuhkan

## Production Deployment (Step-by-Step)

Prosedur deploy migration ke server production. Lihat juga [README utama - Production Deployment](../README.md#production-deployment-step-by-step) untuk alur lengkap (DB prep → migration → build → deploy). Untuk konfigurasi server PostgreSQL (pg_cron, postgresql.conf), lihat [SERVER_CONFIG.md](../SERVER_CONFIG.md).

### Step 1: Copy migration-kit ke server

Copy folder `migration-kit` ke server (misalnya `/app/dashboard-grafana-migration-kit`).

### Step 2: Sinkronkan migrate.ts dan procedure files

Pastikan `src/db/migrate.ts` sama dengan `src/db/migrate.ts` di project utama. Setiap kali migration diubah di repo, salin lagi ke `migration-kit/src/db/migrate.ts`.

**Procedure files:** Pastikan `migration-kit/scripts/success_rate/{app}/procedure.*.sql` sama dengan `scripts/success_rate/{app}/` di project utama. Salin file procedure secara manual (atau lewat diff/merge) bila ada perubahan di repo utama. Tanpa sinkron ini, phase procedures bisa menjalankan SQL yang sudah usang.

### Step 3: Konfigurasi .env

```bash
cp .env.example .env
# Edit .env dengan nilai DB production (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, dll.)
```

**PostgreSQL:** Set `DB_TYPE=postgres` atau `postgresql`, `DB_PORT=5432`. Pastikan `DB_NAME` mengarah ke platform database (bukan database pg_cron).

### Step 4: Install dependency

```bash
npm ci
```

Atau pertama kali: `npm install`

### Step 5: Jalankan migration

```bash
npm run migrate
```

Ini menjalankan semua fase: schema, procedures, cron/events, seed, dan (PostgreSQL) FDW.

**Per fase (opsional):**
- `npm run migrate:schema`   – schema + BetterAuth + processing log + index
- `npm run migrate:procedures` – stored procedure (sp_process_bale_daily)
- `npm run migrate:cron`     – cron/event scheduler
- `npm run migrate:seed`     – seed app identifier + superadmin
- `npm run migrate:fdw`      – (PostgreSQL only) FDW servers, user mappings, prefixed foreign tables + compatibility views

### Step 6: PostgreSQL FDW (jika diperlukan)

Jika migration gagal membuat FDW (mis. extension belum terpasang), selesaikan prerequisite lalu jalankan:

```bash
DB_NAME=platform_db npm run migrate:fdw
```

Pastikan: (1) `postgres_fdw` extension sudah di-install di platform_db, (2) app databases (bale_db, dll.) sudah ada, (3) `app_identifier` punya `db_name` dan `raw_table_name` (jalankan `npm run migrate:schema` dulu jika belum).

**FDW naming (A+A2):** Setiap foreign table diberi nama `{source_db}_{table_name}` (mis. `bale_db_raw_bale`), disertai compatibility view dengan nama pendek asli (mis. `raw_bale`) agar stored procedure yang ada tidak perlu diubah. Jika dua source database mempunyai `table_name` yang sama, yang pertama secara alfabet mendapat view pendek; yang kedua harus query langsung via nama FT yang sudah di-prefix.

## Deploy ke server tanpa akses internet (offline)

Jika server production **tidak punya akses internet**, siapkan migration-kit di mesin yang **ada internet**, lalu copy seluruh folder (termasuk `node_modules`) ke server via SFTP, jump host, atau media fisik.

### Step 1: Prepare on machine with internet

Use a machine with the **same OS and architecture** as production (e.g. Linux x64).

```bash
cd migration-kit
npm install
# Or: npm ci
```

Create `.env` with production values before copying.

**Penting:** Modul native (`pg`, `mysql2`) dikompilasi per OS/arsitektur. Jika production adalah **Linux** dan Anda jalankan `npm install` di **Windows**, binary bisa tidak cocok. Gunakan WSL2, VM, atau CI dengan image Linux.

### Step 2: Copy to production server

**Option A — SCP via jump host:**
```bash
# From your local machine (migration-kit folder is ready with node_modules)
scp -r -o ProxyJump=user@jump-host ./migration-kit user@prod-server:/app/
```

**Option B — SFTP via jump host:**
```bash
# Connect to jump host first, then SFTP to prod
sftp -o ProxyJump=user@jump-host user@prod-server:/app/

# Or use a GUI tool (FileZilla, WinSCP) with jump host / proxy settings
# Upload entire migration-kit folder to /app/migration-kit
```

**Option C — Two-step (jump host as staging):**
```bash
# 1. Copy to jump host
scp -r ./migration-kit user@jump-host:/tmp/

# 2. Copy from jump host to prod (run on jump host)
scp -r /tmp/migration-kit user@prod-server:/app/
```

**Option D — USB / shared drive:** Copy entire `migration-kit` folder (including `node_modules` and `.env`) to the server.

### Step 3: Run migration on server

```bash
cd /app/migration-kit
node --version   # pastikan Node.js 18+ terpasang
npm run migrate
```

No `npm install` needed — `node_modules` is already copied.

## Persyaratan

- Node.js 18+ (atau sesuai yang dipakai project utama)
- Akses jaringan dari server ke database (MySQL atau PostgreSQL)
- Variabel environment yang benar (terutama DB_* dan optional DEFAULT_SU_*, TARGET_DATABASES, BALE_PROCESSING_SCHEDULE, BALE_BISNIS_PROCESSING_SCHEDULE, CMS_PROCESSING_SCHEDULE, BALE_KORPORA_PROCESSING_SCHEDULE)

## Cara kerja offline (tanpa internet)

Script migration memakai `tsx` (TypeScript runner) yang sudah tercantum sebagai `dependency` (bukan `devDependency`), bukan `npx tsx`. Artinya:

- `npm run migrate` → memanggil `node_modules/.bin/tsx src/db/migrate.ts` dari lokal.
- **Tidak ada kontak ke npm registry saat menjalankan migration.**
- Syaratnya: folder `node_modules` harus sudah ada (jalankan `npm install` sekali di mesin yang punya internet, lalu copy seluruh folder migration-kit beserta `node_modules` ke server).

## Catatan

- Migration kit **tidak** menjalankan aplikasi Next.js; hanya untuk menjalankan `migrate.ts`.
- Aplikasi production tetap dijalankan dari folder **standalone** (hasil build Next.js).
- Setelah mengubah `src/db/migrate.ts` di project utama, salin lagi ke `migration-kit/src/db/migrate.ts` agar production memakai versi terbaru.
