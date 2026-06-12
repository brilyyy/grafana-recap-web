# Processing Scheduler Technical Notes

## Code Path Utama
- Scheduler runtime (app-level): `src/lib/scheduler.ts` (data-driven job table `RECAP_JOBS`)
- Server entry yang memulai scheduler: `src/server.ts` (`initializeScheduler()`, idempotent)
- Manual trigger: `src/application/recap/trigger-recap.ts` + tRPC `recap.triggerManual` / `processingLogs.processManual`
- Recap catalog: `src/domain/recap/catalog.ts`
- Migration orchestrator: `src/db/migrate.ts`
- Procedure registry: `scripts/success_rate/registry.ts`
- Procedure runner: `scripts/success_rate/runProcedures.ts`

## Arsitektur Eksekusi
Scheduler berjalan di level aplikasi (node-cron) — selalu aktif saat server start
(pg_cron sudah dihapus; tidak ada mode DB scheduler lagi).

- `initializeScheduler()` membuat satu task node-cron per entry di `RECAP_JOBS`.
- Tiap task memanggil stored procedure DB dengan argumen `NULL::date` (H-1):
  - `sp_process_bale_daily`, `sp_process_bale_bisnis_daily`
  - `sp_process_olob_daily`, `sp_process_cms_daily`
  - `sp_process_bale_korpora_daily`
  - `sp_recap_cms_corp_daily`, `sp_recap_bale_korpora_corp_daily`
- Cron expression divalidasi pakai `cron.validate()`; invalid → fallback default `1 0 * * *`.

## Environment Variables Penting
- `SCHEDULER_TIMEZONE` (default `Asia/Jakarta`)
- `BALE_PROCESSING_SCHEDULE`, `BALE_BISNIS_PROCESSING_SCHEDULE`
- `OLOB_PROCESSING_SCHEDULE`, `CMS_PROCESSING_SCHEDULE`
- `BALE_KORPORA_PROCESSING_SCHEDULE`
- `CMS_CORP_RECAP_SCHEDULE`, `BALE_KORPORA_CORP_RECAP_SCHEDULE`

## Titik Rawan Error
- Cron expression invalid → fallback default `1 0 * * *` (lihat warning di log startup).
- Stored procedure belum ter-deploy (jalankan `pnpm db:migrate:procedures`).
- Job gagal execute karena koneksi DB salah — error tertangkap dan dicatat per job, scheduler tetap hidup.

## Checklist Troubleshooting
1. Cek log startup: `Initializing scheduler...` lalu satu baris `✅ <job> scheduler configured` per job.
2. Cek log per task: `🔄 Starting scheduled ...` / `✅ ... completed` / `❌ ... failed`.
3. Stored procedure: test manual `SELECT public.sp_process_bale_daily(NULL);`.
4. Hasil proses: cek `app_processing_log` (juga tampil di halaman Summary dan Superadmin → Processing).

## External Trigger (machine-to-machine)

Manual recap bisa dipicu tanpa session via tRPC `recap.triggerExternal`,
diautentikasi header `x-recap-api-key` (env `RECAP_TRIGGER_API_KEY`):

```bash
curl -X POST https://host/api/trpc/recap.triggerExternal \
  -H 'content-type: application/json' \
  -H 'x-recap-api-key: <RECAP_TRIGGER_API_KEY>' \
  -d '{"app_name":"Bale","date":"2026-06-10"}'
```

Body menerima `app_name` ATAU `catalogEntryId` (mis. `sr:bale`), plus `date`
opsional (`YYYY-MM-DD`; tanpa `date` = H-1). Endpoint lama
`POST /api/processing/process-manual` sudah dihapus.

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
- [Success Rate SQL README](../../scripts/success_rate/README.md)
- [Project README](../../README.md)
