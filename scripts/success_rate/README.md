# Database Queries and Stored Procedures

This directory contains raw aggregation queries and stored procedure definitions for success rate processing. All SQL and runner code live in one place.

> **Menambahkan aplikasi baru?** Lihat [ADD_NEW_APP.md](../ADD_NEW_APP.md) untuk urutan lengkap: frontend → success rate + raw table → stored procedures → migration-kit → production.

## Directory Structure (Unified Convention)

```
scripts/success_rate/
├── registry.ts              # Central list of apps with procedure metadata
├── runProcedures.ts         # runStoredProcedures() logic - loads and executes procedures
├── README.md
├── bale/
│   ├── raw.mysql.sql        # Raw aggregation query (SELECT from raw_bale)
│   ├── raw.postgres.sql     # Raw aggregation query (SELECT from raw_bale)
│   ├── procedure.mysql.sql  # Full CREATE PROCEDURE sp_process_bale_daily
│   └── procedure.postgres.sql # Full CREATE OR REPLACE FUNCTION sp_process_bale_daily
└── bale_bisnis/
    ├── raw.mysql.sql        # Raw aggregation query
    ├── raw.postgres.sql     # Raw aggregation query
    ├── procedure.mysql.sql  # Full CREATE PROCEDURE sp_process_bale_bisnis_daily
    └── procedure.postgres.sql # Full CREATE OR REPLACE FUNCTION sp_process_bale_bisnis_daily
```

**File naming convention** (per-app folder):
- `raw.{mysql|postgres}.sql` – Raw aggregation SELECT queries (reusable, ad-hoc)
- `procedure.{mysql|postgres}.sql` – Full CREATE PROCEDURE/FUNCTION (used by migration)

## Success Rate Queries

### BALE Application

- **Raw queries**: `bale/raw.mysql.sql`, `bale/raw.postgres.sql`
- **Stored procedures**: `bale/procedure.mysql.sql`, `bale/procedure.postgres.sql`

These aggregate transaction data from `raw_bale` table. The procedure files embed the same logic as the raw queries.

**Cross-DB Architecture**: CDC creates raw tables in `db_{app_name}` (e.g., `db_bale`), not in `platform_db`. MySQL uses `db_bale.raw_bale` syntax. PostgreSQL uses postgres_fdw: a foreign table `raw_bale` in platform_db points to `db_bale.raw_bale`. Configure `db_name` and `raw_table_name` in `app_identifier` (Superadmin > App Config).

### BALE BISNIS Application

- **Raw queries**: `bale_bisnis/raw.mysql.sql`, `bale_bisnis/raw.postgres.sql`
- **Stored procedures**: `bale_bisnis/procedure.mysql.sql`, `bale_bisnis/procedure.postgres.sql`

These aggregate transaction data from `raw_bale_bisnis` table. Uses `BALE_BISNIS_PROCESSING_SCHEDULE` env var (default: `1 0 * * *`). MySQL: `db_bale_bisnis.raw_bale_bisnis`. PostgreSQL: FDW `raw_bale_bisnis`.

### Adding New Applications

1. Create `scripts/success_rate/{app_key}/` with:
   - `raw.mysql.sql`, `raw.postgres.sql` (aggregation queries)
   - `procedure.mysql.sql`, `procedure.postgres.sql` (stored procedures)
2. Add `{ appKey: 'app_key', procedureName: 'sp_process_app_key_daily' }` to `registry.ts`
3. No changes needed to `runProcedures.ts` or `migrate.ts`

**Note**: Only add to `registry.ts` when procedure files exist.

## Stored Procedures

Stored procedures are defined in this directory and executed by `src/db/migrate.ts` Phase 5. The migration imports `runProcedures` from `scripts/success_rate/runProcedures.ts`, which loads each app's `procedure.{mysql|postgres}.sql` and executes it.

### BALE Processing Procedure

**Procedure Name**: `sp_process_bale_daily()`

**Schedule**: Runs daily at 00:01 (1 minute past midnight)

**Functionality**:
1. Calculates H-1 (yesterday) date range (00:00:00 to 23:59:59)
2. Looks up `id_app_identifier` for 'Bale' from `app_identifier` table
3. Deletes existing data for the processing date (replace strategy)
4. Executes aggregation query from `raw_bale` table
5. For each row:
   - Normalizes RC (handles NULL, empty string, or '-')
   - Checks for success indicators in RC Description or Status
   - Sets RC='00' if success indicators found
   - Looks up `error_type` from `response_code_dictionary`
   - Inserts into `unmapped_rc` if RC not found in dictionary
   - Inserts into `app_success_rate` with mapped `error_type`
6. Logs processing status to `app_processing_log` table

**Business Rules**:
- RC normalization: If RC is NULL/empty/'-' and success indicators exist → set RC='00'
- Error type mapping: Exact match required (`id_app_identifier + jenis_transaksi + rc`)
- Unmapped RC: If RC not in dictionary → insert into `unmapped_rc`
- No RC Transaction: If RC is NULL/empty/'-' without success indicators → `error_type = NULL`

### BALE BISNIS Processing Procedure

**Procedure Name**: `sp_process_bale_bisnis_daily()`

**Schedule**: Uses `BALE_BISNIS_PROCESSING_SCHEDULE` (default: 00:01 daily)

**Functionality**: Same as Bale – aggregates from `raw_bale_bisnis`, inserts into `app_success_rate`. Uses CROSS JOIN structure (days × features × statuses × states) for full matrix output.

## Installation and Setup

### MySQL

1. **Run Migration**:
   ```bash
   npm run db:migrate
   ```
   Or procedures only: `npm run db:migrate:procedures`

2. **Verify Event Scheduler**:
   ```sql
   SHOW VARIABLES LIKE 'event_scheduler';
   ```
   Should return `ON`. If not, enable it:
   ```sql
   SET GLOBAL event_scheduler = ON;
   ```

3. **Verify Events Created**:
   ```sql
   SHOW EVENTS LIKE 'evt_process_bale_daily';
   SHOW EVENTS LIKE 'evt_process_bale_bisnis_daily';
   ```

4. **Manual Trigger** (for testing):
   ```sql
   CALL sp_process_bale_daily();
   CALL sp_process_bale_bisnis_daily();
   ```

### PostgreSQL

Migration akan otomatis mencoba menggunakan scheduler yang tersedia dengan urutan prioritas:
1. **Application-Level Scheduler (node-cron)** - jika `USE_APP_LEVEL_SCHEDULER=true` (Recommended for Windows)
2. **pg_cron** (preferred) - jika extension tersedia
3. **pgAgent** (fallback) - jika pg_cron tidak tersedia
4. **Manual setup** - jika keduanya tidak tersedia

**Catatan**: Setiap app punya schedule terpisah:
- **Bale**: `BALE_PROCESSING_SCHEDULE` (default: `1 0 * * *`)
- **Bale Bisnis**: `BALE_BISNIS_PROCESSING_SCHEDULE` (default: `1 0 * * *`)

#### Option 1: Application-Level Scheduler (Recommended for Windows)

**Keuntungan**:
- ✅ Tidak perlu setup database extension
- ✅ Bekerja di Windows tanpa konfigurasi tambahan
- ✅ Mudah di-debug dan di-maintain
- ✅ Cross-platform (Windows, Linux, macOS)

**Catatan Penting**: Aplikasi harus running saat waktu eksekusi tiba (00:01). Untuk production yang memerlukan reliability tinggi, pertimbangkan menggunakan database scheduler.

1. **Install node-cron**:
   ```bash
   npm install node-cron
   npm install --save-dev @types/node-cron
   ```

2. **Set environment variables**:
   ```env
   USE_APP_LEVEL_SCHEDULER=true
   SCHEDULER_TIMEZONE=Asia/Jakarta  # Optional, default: Asia/Jakarta
   BALE_PROCESSING_SCHEDULE=1 0 * * *  # Bale (default: 00:01 daily)
   BALE_BISNIS_PROCESSING_SCHEDULE=1 0 * * *  # Bale Bisnis (default: 00:01 daily)
   ```
   
   **Cron Schedule Format** (per-app env vars):
   - Format: `minute hour day month dayOfWeek`
   - Default: `1 0 * * *` (runs at 00:01 every day)
   - **Digunakan oleh semua scheduler**: app-level (node-cron), pg_cron, pgAgent, dan MySQL events
   - Examples:
     - `1 0 * * *` - Daily at 00:01 (default)
     - `0 2 * * *` - Daily at 02:00
     - `30 1 * * 1` - Every Monday at 01:30
     - `0 */6 * * *` - Every 6 hours
   - If invalid format is provided, default schedule (`1 0 * * *`) will be used

3. **Run Migration** (will create stored procedure only, skip database scheduler):
   ```bash
   DB_TYPE=postgresql npm run db:migrate
   ```

4. **Start Application**:
   ```bash
   npm run dev
   # or for production
   npm start
   ```
   
   Scheduler akan otomatis berjalan saat aplikasi start. Anda akan melihat log:
   ```
   ℹ️  Initializing application-level scheduler for PostgreSQL...
   ✅ BALE processing scheduler configured: Schedule '1 0 * * *' (timezone: Asia/Jakarta)
   ```

5. **Verify Function Created**:
   ```sql
   SELECT proname FROM pg_proc WHERE proname = 'sp_process_bale_daily';
   ```

6. **Verify Scheduler Running**:
   - Check application logs saat startup untuk konfirmasi scheduler initialized
   - Log akan menampilkan schedule yang digunakan (default: `1 0 * * *` = 00:01 daily)
   - Scheduler akan otomatis execute stored procedure sesuai schedule yang dikonfigurasi

**Troubleshooting**:
- Pastikan aplikasi running saat waktu eksekusi (00:01)
- Check application logs untuk error messages
- Pastikan environment variable `USE_APP_LEVEL_SCHEDULER=true` sudah di-set
- Untuk production, pertimbangkan menggunakan process manager seperti PM2 untuk memastikan aplikasi selalu running

#### Option 2: Using pg_cron (Recommended for Linux/Unix)

**Catatan**: pg_cron menggunakan environment variable `BALE_PROCESSING_SCHEDULE` untuk konfigurasi schedule. Default: `1 0 * * *` (00:01 setiap hari).

**Penting**: Semua setup (table, procedure, dan job pg_cron) dilakukan oleh **satu file migration** (`CreateBaleProcessingProcedure`). Perilakuan tergantung database yang dikoneksi saat migration dijalankan:
- **DB_NAME=platform_db** (atau platform_db_dev): migration membuat table + procedure di database tersebut; job cron **tidak** dibuat (karena pg_cron biasanya tidak di-install di sana).
- **DB_NAME=postgres** (database yang punya extension pg_cron): migration **hanya** mendaftarkan job pg_cron di `cron.job`; table/procedure tidak dibuat di postgres.

Jadi untuk setup lengkap: jalankan migration sekali ke database target (procedure), lalu sekali ke database postgres (job cron).

1. **Set environment variable** (optional, untuk custom schedule):
   ```env
   BALE_PROCESSING_SCHEDULE=1 0 * * *  # Default: 00:01 setiap hari
   ```

2. **Install pg_cron Extension** (if not already installed), di database yang dipakai untuk scheduler (biasanya `postgres`):
   ```sql
   CREATE EXTENSION IF NOT EXISTS pg_cron;
   ```
   Note: Requires PostgreSQL restart and `shared_preload_libraries = 'pg_cron'` in postgresql.conf.
   Migration uses `cron.schedule_in_database()` to run jobs in target databases; **pg_cron 1.4+** is required.
   **Server config:** See [SERVER_CONFIG.md](../SERVER_CONFIG.md) for `postgresql.conf` (e.g. `cron.use_background_workers = on`) to avoid "connection failed".

3. **Jalankan migration** (semua dari satu file migration):
   - Buat table + procedure di database target:
     ```bash
     DB_NAME=platform_db DB_TYPE=postgresql npm run db:migrate
     ```
   - Daftarkan job pg_cron di database yang punya pg_cron:
     ```bash
     DB_NAME=postgres DB_TYPE=postgresql npm run db:migrate
     ```
   **Catatan**: Migration sekarang selalu membuat job pg_cron ketika dijalankan ke database yang punya pg_cron (tidak lagi bergantung pada `USE_APP_LEVEL_SCHEDULER`). Jika Anda pernah menjalankan migration ke postgres saat `USE_APP_LEVEL_SCHEDULER=true` dulu sehingga job tidak terbentuk, lakukan sekali: `DB_NAME=postgres npm run db:migrate`, lalu `DB_NAME=postgres DB_TYPE=postgresql npm run db:migrate` lagi.

4. **Verify Function Created** (di database target, mis. platform_db):
   ```sql
   SELECT proname FROM pg_proc WHERE proname = 'sp_process_bale_daily';
   ```

5. **Verify Cron Job** (di database yang punya pg_cron, mis. postgres):
   ```sql
   SELECT jobid, jobname, schedule, nodename, nodeport, database FROM cron.job WHERE jobname LIKE 'process-bale-daily-%';
   ```
   **Penting**: pg_cron memakai Row-Level Security (RLS) pada `cron.job`. Anda hanya melihat job yang dibuat oleh **user yang sama** dengan yang sedang login. Jadi pastikan koneksi ke database `postgres` memakai **user yang sama dengan DB_USER** saat menjalankan migration (bukan user lain, mis. postgres vs app_user). Jika Anda login sebagai superuser (mis. postgres), Anda akan melihat job yang dibuat oleh user tersebut.

   **Connection failed**: Jika `cron.job_run_details` menampilkan `status='failed'` dan `return_message='connection failed'`, lihat [SERVER_CONFIG.md](../SERVER_CONFIG.md). Pastikan `cron.use_background_workers = on` di postgresql.conf; migration mengatur `nodename`/`nodeport` dari `DB_HOST`/`DB_PORT`.

#### Option 3: Using pgAgent (Cross-platform, including Windows)

**Catatan**: pgAgent menggunakan environment variable `BALE_PROCESSING_SCHEDULE` untuk konfigurasi schedule. Default: `1 0 * * *` (00:01 setiap hari).

1. **Set environment variable** (optional, untuk custom schedule):
   ```env
   BALE_PROCESSING_SCHEDULE=1 0 * * *  # Default: 00:01 setiap hari
   ```

2. **Install pgAgent** (if not already installed):
   - Download and install pgAgent from: https://www.pgadmin.org/download/pgagent/
   - Install pgAgent extension in database:
     ```sql
     CREATE EXTENSION IF NOT EXISTS pgagent;
     ```
   - Ensure pgAgent service is running

3. **Run Migration**:
   ```bash
   DB_TYPE=postgresql npm run db:migrate
   ```
   Migration akan otomatis menggunakan pgAgent jika pg_cron tidak tersedia.

4. **Verify Function Created**:
   ```sql
   SELECT proname FROM pg_proc WHERE proname = 'sp_process_bale_daily';
   ```

5. **Verify pgAgent Job**:
   ```sql
   SELECT j.jobid, j.jobname, j.jobdesc, j.jobenabled
   FROM pgagent.pga_job j
   WHERE j.jobname = 'process-bale-daily';
   
   -- Check schedule
   SELECT s.*
   FROM pgagent.pga_schedule s
   JOIN pgagent.pga_job j ON s.jscjobid = j.jobid
   WHERE j.jobname = 'process-bale-daily';
   ```

#### Option 4: Manual Setup (if all schedulers unavailable)

1. **Run Migration** (will create stored procedure only):
   ```bash
   DB_TYPE=postgresql npm run db:migrate
   ```

2. **Setup External Cron**:
   
   **Linux/Unix** - Add to crontab (`crontab -e`):
   ```
   1 0 * * * psql -U your_user -d your_database -c "SELECT sp_process_bale_daily();"
   ```
   
   **Windows** - Use Task Scheduler:
   - Create new scheduled task
   - Action: Run program
   - Program: `psql.exe`
   - Arguments: `-U your_user -d your_database -c "SELECT sp_process_bale_daily();"`
   - Schedule: Daily at 00:01

#### Manual Trigger (for testing):
```sql
SELECT sp_process_bale_daily();
```

## Monitoring

### Check Processing Logs

```sql
-- Get latest processing status
SELECT * FROM app_processing_log 
WHERE app_name = 'Bale' 
ORDER BY created_at DESC 
LIMIT 10;

-- Check for failed processing
SELECT * FROM app_processing_log 
WHERE app_name = 'Bale' 
  AND status = 'failed' 
ORDER BY created_at DESC;

-- Check processing statistics
SELECT 
  app_name,
  processing_date,
  status,
  records_processed,
  records_inserted,
  start_time,
  end_time,
  TIMESTAMPDIFF(SECOND, start_time, end_time) AS duration_seconds
FROM app_processing_log
WHERE app_name = 'Bale'
ORDER BY created_at DESC
LIMIT 10;
```

### Check Processing Results

```sql
-- Count records inserted for a specific date
SELECT COUNT(*) 
FROM app_success_rate 
WHERE id_app_identifier = (SELECT id FROM app_identifier WHERE app_name = 'Bale')
  AND tanggal_transaksi = DATE_SUB(CURDATE(), INTERVAL 1 DAY);

-- Check for unmapped RCs
SELECT COUNT(*) 
FROM unmapped_rc 
WHERE id_app_identifier = (SELECT id FROM app_identifier WHERE app_name = 'Bale');
```

## Manual Trigger via API

You can manually trigger processing via API endpoint:

```bash
POST /api/bale/process-manual
Authorization: Bearer <token>

# Optional: Process specific date
POST /api/bale/process-manual?date=2024-01-15
```

**Requirements**:
- User must be authenticated
- User must have `admin` or `superadmin` role

**Response**:
```json
{
  "success": true,
  "message": "BALE processing triggered successfully (H-1)",
  "data": {
    "processingDate": "H-1 (yesterday)",
    "logEntry": {
      "id": 1,
      "status": "success",
      "recordsProcessed": 100,
      "recordsInserted": 100,
      "startTime": "2024-01-15T00:01:00Z",
      "endTime": "2024-01-15T00:01:30Z",
      "errorMessage": null
    }
  }
}
```

## How to Check Everything Working

Complete verification checklist. Run these in order to confirm the full pipeline is operational.

### 1. Migration

```bash
npm run db:migrate
```

Expect no errors. Phases 1–5 should complete.

### 2. Cross-Database Access

**MySQL** (`db_bale` is the app database; `platform_db` is the main DB):

```sql
-- Connect to platform_db
SELECT COUNT(*) FROM db_bale.raw_bale;
```

Should return a row count (or 0 if CDC has not populated yet).

**PostgreSQL** (FDW in `platform_db`):

```sql
-- Connect to platform_db
SELECT COUNT(*) FROM raw_bale;
```

Should return a row count. If `ERROR: relation "raw_bale" does not exist`, FDW setup failed or app databases are missing.

**PostgreSQL FDW details** (optional):

```sql
SELECT extname FROM pg_extension WHERE extname = 'postgres_fdw';
SELECT srvname FROM pg_foreign_server WHERE srvname LIKE '%_server';
SELECT foreign_table_name, foreign_server_name FROM information_schema.foreign_tables;
SELECT s.srvname, um.umuser::regrole FROM pg_foreign_server s
LEFT JOIN pg_user_mapping um ON um.umserver = s.oid WHERE s.srvname LIKE '%_server';
```

### 3. Stored Procedure

**MySQL**:

```sql
SHOW PROCEDURE STATUS WHERE Name = 'sp_process_bale_daily';
```

**PostgreSQL**:

```sql
SELECT proname FROM pg_proc WHERE proname = 'sp_process_bale_daily';
```

### 4. Scheduler

**MySQL**:

```sql
SHOW VARIABLES LIKE 'event_scheduler';   -- Should be ON
SHOW EVENTS LIKE 'evt_process_bale_daily';
```

**PostgreSQL (app-level)**:

Check application startup logs for:

```
✅ BALE processing scheduler configured: Schedule '1 0 * * *'
```

**PostgreSQL (pg_cron)**:

```sql
SELECT jobid, jobname, schedule, database FROM cron.job WHERE jobname LIKE 'process-bale%';
```

### 5. Manual Trigger (End-to-End)

**MySQL**:

```sql
CALL sp_process_bale_daily();
```

**PostgreSQL**:

```sql
SELECT sp_process_bale_daily();
```

Then verify:

```sql
SELECT * FROM app_processing_log WHERE app_name = 'Bale' ORDER BY created_at DESC LIMIT 1;
SELECT COUNT(*) FROM app_success_rate WHERE id_app_identifier = (SELECT id FROM app_identifier WHERE app_name = 'Bale');
```

### 6. API Manual Trigger

```bash
# Login first, then:
curl -X POST http://localhost:3000/api/processing/process-manual \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-session-cookie>" \
  -d '{"app_name": "Bale"}'

# Optional: process specific date
curl -X POST http://localhost:3000/api/processing/process-manual \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-session-cookie>" \
  -d '{"app_name": "Bale", "date": "2024-01-15"}'
```

Or use the UI: Superadmin → Process Manual (if available).

### 7. Application

1. `npm run dev`
2. Open `http://localhost:3000/login`
3. Login with an approved user
4. Navigate to Success Rate or Dashboard — data should load without errors

If any step fails, see [Troubleshooting](#troubleshooting) below.

## Troubleshooting

### MySQL: Event Not Running

1. **Check Event Scheduler Status**:
   ```sql
   SHOW VARIABLES LIKE 'event_scheduler';
   ```

2. **Enable Event Scheduler** (if disabled):
   ```sql
   SET GLOBAL event_scheduler = ON;
   ```

3. **Check Event Status**:
   ```sql
   SELECT * FROM information_schema.EVENTS 
   WHERE EVENT_NAME = 'evt_process_bale_daily';
   ```

4. **Check Event History** (MySQL 5.7+):
   ```sql
   SELECT * FROM performance_schema.events_statements_history_long 
   WHERE OBJECT_NAME = 'sp_process_bale_daily' 
   ORDER BY TIMER_END DESC 
   LIMIT 10;
   ```

### PostgreSQL: Function Not Running

1. **Check Function Exists**:
   ```sql
   SELECT proname, prosrc FROM pg_proc WHERE proname = 'sp_process_bale_daily';
   ```

2. **Check Which Scheduler is Being Used**:
   
   **If using pg_cron:**
   ```sql
   -- Check pg_cron extension
   SELECT * FROM pg_extension WHERE extname = 'pg_cron';
   
   -- Check cron jobs
   SELECT * FROM cron.job WHERE jobname = 'process-bale-daily';
   SELECT * FROM cron.job_run_details 
   WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'process-bale-daily')
   ORDER BY start_time DESC LIMIT 10;
   ```
   
   **If using pgAgent:**
   ```sql
   -- Check pgAgent schema exists
   SELECT EXISTS(
     SELECT 1 FROM information_schema.schemata WHERE schema_name = 'pgagent'
   ) AS pgagent_available;
   
   -- Check pgAgent job
   SELECT j.jobid, j.jobname, j.jobdesc, j.jobenabled
   FROM pgagent.pga_job j
   WHERE j.jobname = 'process-bale-daily';
   
   -- Check pgAgent schedule
   SELECT s.*
   FROM pgagent.pga_schedule s
   JOIN pgagent.pga_job j ON s.jscjobid = j.jobid
   WHERE j.jobname = 'process-bale-daily';
   
   -- Check pgAgent job steps
   SELECT st.*
   FROM pgagent.pga_jobstep st
   JOIN pgagent.pga_job j ON st.jstjobid = j.jobid
   WHERE j.jobname = 'process-bale-daily';
   
   -- Check pgAgent job run history
   SELECT jh.*
   FROM pgagent.pga_joblog jh
   JOIN pgagent.pga_job j ON jh.jlgjobid = j.jobid
   WHERE j.jobname = 'process-bale-daily'
   ORDER BY jh.jlgstart DESC LIMIT 10;
   ```

3. **Troubleshooting pgAgent**:
   - Ensure pgAgent service is running
   - Check pgAgent connection settings in pgAgent configuration
   - Verify database connection from pgAgent service
   - Check pgAgent logs for errors

4. **Test Function Manually**:
   ```sql
   SELECT sp_process_bale_daily();
   ```

### Common Issues

1. **"Application Bale not found"**:
   - Ensure 'Bale' exists in `app_identifier` table
   - Check: `SELECT * FROM app_identifier WHERE app_name = 'Bale';`

2. **"raw_bale table does not exist"**:
   - The `raw_bale` table is created by CDC (Change Data Capture)
   - Ensure CDC is configured and running

3. **"No data processed"**:
   - Check if `raw_bale` has data for the processing date
   - Verify date range calculation (H-1 = yesterday)
   - Check transaction_state filter: must be IN ('1','9','8')

4. **"Processing failed"**:
   - Check `app_processing_log` table for error message
   - Verify foreign key constraints
   - Check database connection and permissions

5. **"Duplicate key error"**:
   - The procedure uses replace strategy (DELETE + INSERT)
   - If error occurs, check if DELETE is working correctly
   - Verify transaction is properly committed

## Performance Considerations

1. **Indexing**: Ensure `raw_bale.transaction_date` is indexed (created by CDC)
2. **Batch Size**: For very large datasets, consider batch processing
3. **Lock Time**: DELETE + INSERT in transaction may lock tables
4. **Execution Time**: Processing runs at 00:01 to minimize impact

## Adding New Applications (detailed)

To add processing for a new application (e.g., CMS):

1. **Create** `scripts/success_rate/cms/` with:
   - `raw.mysql.sql`, `raw.postgres.sql` (aggregation queries)
   - `procedure.mysql.sql`, `procedure.postgres.sql` (stored procedures)

2. **Register** in `scripts/success_rate/registry.ts`:
   - Add `{ appKey: 'cms', procedureName: 'sp_process_cms_daily' }` to `PROCEDURE_APPS`

3. **Run Migration**:
   ```bash
   npm run db:migrate
   ```

4. **Create API Endpoint** (optional):
   - `src/app/api/cms/process-manual/route.ts`
   - Follow pattern from `src/app/api/bale/process-manual/route.ts`

## Support

For issues or questions:
1. Check `app_processing_log` table for error details
2. Review database logs
3. Test stored procedure manually
4. Check CDC status for `raw_bale` table
