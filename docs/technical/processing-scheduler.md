# Processing Scheduler Technical Notes

## Code Path Utama
- Scheduler runtime (app-level): `src/lib/scheduler.ts`
- Migration orchestrator: `src/db/migrate.ts`
- Procedure registry: `scripts/success_rate/registry.ts`
- Procedure runner: `scripts/success_rate/runProcedures.ts`

## Arsitektur Eksekusi
### 1) App-level scheduler
- Aktif jika `USE_APP_LEVEL_SCHEDULER=true`.
- `initializeScheduler()` akan membuat task node-cron per app.
- Tiap task memanggil function DB:
  - `sp_process_bale_daily`
  - `sp_process_bale_bisnis_daily`
  - `sp_process_olob_daily`
  - `sp_process_cms_daily`
  - dan recap functions lain.

### 2) DB scheduler (pg_cron)
- Diatur saat `runCronSetup(...)` di `src/db/migrate.ts`.
- Menggunakan `cron.schedule_in_database(...)`.
- Job dibentuk dari `PROCEDURE_APPS` (registry-driven).

## Environment Variables Penting
- `USE_APP_LEVEL_SCHEDULER`
- `SCHEDULER_TIMEZONE`
- `BALE_PROCESSING_SCHEDULE`
- `BALE_BISNIS_PROCESSING_SCHEDULE`
- `OLOB_PROCESSING_SCHEDULE`
- `CMS_PROCESSING_SCHEDULE`

## Titik Rawan Error
- Scheduler tidak jalan karena env `USE_APP_LEVEL_SCHEDULER` bukan `true`.
- Cron expression invalid -> fallback default `1 0 * * *`.
- `pg_cron` extension tidak tersedia di database cron.
- Job ada tapi gagal execute karena koneksi host/port salah.

## Checklist Troubleshooting
1. App-level mode:
   - cek log startup: `Initializing application-level scheduler`.
   - cek log per task: success/fail.
2. pg_cron mode:
   - pastikan migration dijalankan juga pada DB yang punya `pg_cron`.
   - cek `cron.job` dan `cron.job_run_details`.
3. Stored procedure:
   - test manual `SELECT public.sp_process_bale_daily(NULL);`.
4. Hasil proses:
   - cek `app_processing_log`.

## Query Debug SQL
```sql
SELECT jobid, jobname, schedule, database, active
FROM cron.job
ORDER BY jobid DESC;

SELECT *
FROM app_processing_log
ORDER BY created_at DESC
LIMIT 30;
```

## Related Docs
- [Technical Index](README.md)
- [Feature: Processing Scheduler](../features/processing-scheduler.md)
- [Migration Kit README](../../migration-kit/README.md)
- [Success Rate SQL README](../../scripts/success_rate/README.md)
- [Project README](../../README.md)
