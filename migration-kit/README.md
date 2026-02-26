# Migration Kit

Folder ini berisi script dan dependency untuk menjalankan migration database **di server production**, terpisah dari deploy aplikasi Next.js (standalone).

## Isi

- `package.json` – dependency (dotenv, bcryptjs, pg, mysql2, tsx, typescript) dan script migration
- `tsconfig.json` – konfigurasi TypeScript untuk menjalankan `src/db/migrate.ts`
- `src/db/migrate.ts` – script migration lengkap (salinan dari project utama)
- `.env.example` – contoh variabel environment yang dibutuhkan

## Production Deployment (Step-by-Step)

Prosedur deploy migration ke server production. Lihat juga [README utama - Production Deployment](../README.md#production-deployment-step-by-step) untuk alur lengkap (DB prep → migration → build → deploy).

### Step 1: Copy migration-kit ke server

Copy folder `migration-kit` ke server (misalnya `/app/dashboard-grafana-migration-kit`).

### Step 2: Sinkronkan migrate.ts

Pastikan `src/db/migrate.ts` sama dengan `src/db/migrate.ts` di project utama. Setiap kali migration diubah di repo, salin lagi ke `migration-kit/src/db/migrate.ts`.

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
- `npm run migrate:fdw`      – (PostgreSQL only) FDW servers, user mappings, foreign tables

### Step 6: PostgreSQL FDW (jika diperlukan)

Jika migration gagal membuat FDW (mis. extension belum terpasang), selesaikan prerequisite lalu jalankan:

```bash
DB_NAME=platform_db npm run migrate:fdw
```

Pastikan: (1) `postgres_fdw` extension sudah di-install di platform_db, (2) app databases (db_bale, dll.) sudah ada, (3) `app_identifier` punya `db_name` dan `raw_table_name` (jalankan `npm run migrate:schema` dulu jika belum).

## Deploy ke server tanpa akses internet (offline)

Jika server production **tidak punya akses internet**, siapkan migration-kit di mesin yang **ada internet**, lalu copy seluruh folder (termasuk `node_modules`) ke server (USB, shared drive, atau dari jump host).

1. **Di mesin yang ada internet** (usahakan **OS dan arsitektur sama** dengan server production, mis. sama-sama Linux x64):
   ```bash
   cd migration-kit
   npm install
   ```
   (Opsi: buat `package-lock.json` dengan `npm install` sekali, lalu gunakan `npm ci` di kemudian hari agar versi dependency konsisten.)

2. **Copy seluruh folder `migration-kit`** ke server (termasuk `node_modules` dan `.env`). Jangan lupa file `.env` berisi konfigurasi production.

3. **Di server** (tanpa perlu `npm install`):
   ```bash
   cd /path/to/migration-kit
   node --version   # pastikan Node.js 18+ terpasang
   npm run migrate
   ```

**Penting:** Modul native (`pg`, `mysql2`) dikompilasi per OS/arsitektur. Jika production adalah **Linux** dan Anda jalankan `npm install` di **Windows**, binary bisa tidak cocok. Solusi: jalankan `npm install` di lingkungan Linux (WSL2, VM, atau CI dengan image Linux) lalu copy hasilnya ke server.

## Persyaratan

- Node.js 18+ (atau sesuai yang dipakai project utama)
- Akses jaringan dari server ke database (MySQL atau PostgreSQL)
- Variabel environment yang benar (terutama DB_* dan optional DEFAULT_SU_*, TARGET_DATABASES, BALE_PROCESSING_SCHEDULE)

## Cara kerja offline (tanpa internet)

Script migration memakai `tsx` (TypeScript runner) yang sudah tercantum sebagai `dependency` (bukan `devDependency`), bukan `npx tsx`. Artinya:

- `npm run migrate` → memanggil `node_modules/.bin/tsx src/db/migrate.ts` dari lokal.
- **Tidak ada kontak ke npm registry saat menjalankan migration.**
- Syaratnya: folder `node_modules` harus sudah ada (jalankan `npm install` sekali di mesin yang punya internet, lalu copy seluruh folder migration-kit beserta `node_modules` ke server).

## Catatan

- Migration kit **tidak** menjalankan aplikasi Next.js; hanya untuk menjalankan `migrate.ts`.
- Aplikasi production tetap dijalankan dari folder **standalone** (hasil build Next.js).
- Setelah mengubah `src/db/migrate.ts` di project utama, salin lagi ke `migration-kit/src/db/migrate.ts` agar production memakai versi terbaru.
