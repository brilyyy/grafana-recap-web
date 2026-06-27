# Processing Scheduler Technical Notes

## Code Path Utama
- Scheduler worker (proses terpisah, di-fork dari server): `src/workers/scheduler-worker.ts` — baca `scheduler_jobs WHERE enabled = true`, daftarkan satu `node-cron` task per row.
- Server entry yang fork/restart worker: `src/server.ts` (`startSchedulerWorker()`, `restartSchedulerWorker()` via `globalThis.__restartScheduler`).
- Job CRUD (UI-driven, live, tanpa redeploy): tRPC `src/server/trpc/routers/scheduler.ts` (`listJobs`/`createJob`/`updateJob`/`deleteJob`/`toggleJob`) — tiap mutation memanggil `restartSchedulerWorker()`.
- Baseline seed (untuk fresh install): `src/db/seed-schedules.ts` (`SEED_JOBS`, idempotent — `ON CONFLICT ("procedure") DO NOTHING`), dijalankan otomatis saat `pnpm db:migrate` (fase cron) atau manual via `pnpm db:seed-schedules`.
- Tabel `scheduler_jobs`: DDL di `src/db/sql/06_cron/scheduler_jobs.sql`.
- Manual trigger (UI, perlu session superadmin): `src/lib/application/recap/trigger-recap.ts` + tRPC `recap.triggerManual`.
- Recap catalog: `src/lib/domain/recap/catalog.ts` (`buildRecapCatalog()`, dibangun dari `@meta` frontmatter tiap file procedure — lihat [success-rate-sql.md](../operations/success-rate-sql.md)) plus procedure ad-hoc dari tabel `app_custom_procedure`.
- Migration orchestrator: `src/db/migrate.ts`.
- `src/lib/scheduler.ts` (array `RECAP_JOBS` lama) **sudah tidak dipakai** — jangan diedit untuk menambah job baru, lihat [add-new-app.md](../operations/add-new-app.md) bagian "Update Scheduler".

## Arsitektur Eksekusi
Scheduler berjalan sebagai proses worker terpisah (`src/workers/scheduler-worker.ts`),
di-fork dari proses utama server saat startup dan otomatis di-restart setiap kali job
dibuat/diupdate/dihapus/di-toggle lewat **Superadmin → Scheduler** — tanpa redeploy.
Tidak ada lagi pg_cron atau mode DB scheduler.

- Worker membaca seluruh baris `scheduler_jobs` yang `enabled = true`, lalu membuat satu task `node-cron` per row dengan timezone per-job (kolom `timezone`, fallback `Asia/Jakarta` jika kosong — bukan dari env).
- Tiap task memanggil stored procedure DB (kolom `procedure`) dengan argumen `NULL::date` (H-1). Procedure yang ter-seed lewat `SEED_JOBS` saat ini:
  - `sp_process_bale_daily`, `sp_process_bale_bisnis_daily`
  - `sp_process_olob_daily`, `sp_process_cms_daily`
  - `sp_process_bale_korpora_daily`
  - `sp_recap_cms_corp_daily`, `sp_recap_bale_korpora_corp_daily`
  - `sp_process_edc_agen_daily`, `sp_process_edc_merchant_daily`, `sp_process_edc_merchant_ancol_daily`
  - `sp_process_debit_online_daily`
  - `sp_run_raw_housekeeping`
- Cron expression divalidasi pakai `cron.validate()`; invalid → job di-**skip** (warning log), **tidak** fallback ke default manapun.

## Scheduler Jobs — DB-driven, bukan Environment Variables

Tidak ada lagi env var per-app (`BALE_PROCESSING_SCHEDULE`, dst.) — semua schedule
hidup di kolom `schedule` tabel `scheduler_jobs`, diedit lewat Superadmin → Scheduler
atau `SEED_JOBS`. `SCHEDULER_TIMEZONE` di `src/env.ts` masih ada tapi **tidak dibaca**
oleh worker (worker pakai kolom `timezone` per-job) — abaikan env ini.

## Titik Rawan Error
- Cron expression invalid → job di-skip, cek warning `Invalid cron, skipping` di log worker.
- Stored procedure belum ter-deploy (jalankan `pnpm db:migrate:procedures`).
- Job gagal execute karena koneksi DB salah — error tertangkap, dicatat ke `scheduler_jobs.lastError`/`lastStatus`, worker tetap hidup untuk job lain.
- Worker tidak restart setelah create/update job lewat UI → cek log server untuk `restartSchedulerWorker` / proses child mati (worker re-fork otomatis saat dipanggil ulang).

## Checklist Troubleshooting
1. Cek log boot worker: `Ready` (`{ pid, jobCount }`), lalu satu baris `Job scheduled` per job aktif (atau `Invalid cron, skipping` untuk job yang salah format).
2. Cek log per run: `Job starting` / `Job completed` / `Job failed` (dengan `durationMs`).
3. Stored procedure: test manual `SELECT public.sp_process_bale_daily(NULL);`.
4. Hasil proses: cek `app_processing_log` (juga tampil di halaman Summary dan Superadmin → Processing) serta kolom `lastStatus`/`lastRunAt` di `scheduler_jobs` (tampil di Superadmin → Scheduler).
5. Habis ubah job lewat UI tapi belum efektif? Worker di-restart otomatis (`restartSchedulerWorker()`) — kalau masih stuck, cek proses child masih hidup di log server.

## Manual Trigger

Recap manual hanya bisa dipicu lewat UI (Superadmin) via tRPC `recap.triggerManual`
(`superAdminProcedure`, butuh session) dengan input `catalogEntryId` (mis. `sr:bale`)
plus `date` opsional (`YYYY-MM-DD`; tanpa `date` = H-1). Tidak ada lagi endpoint
machine-to-machine (`recap.triggerExternal` / `RECAP_TRIGGER_API_KEY` / endpoint REST
lama) — semua itu sudah dihapus dari codebase.

## Query Debug SQL
```sql
SELECT *
FROM app_processing_log
ORDER BY created_at DESC
LIMIT 30;
```

## Related Docs
- [Technical Index](README.md)
- [Feature: Processing Scheduler](../features/processing-scheduler.md)
- [Success Rate SQL README](../operations/success-rate-sql.md)
- [Project README](../../README.md)
