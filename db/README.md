# Database Queries and Stored Procedures

This directory contains database-specific queries and stored procedures for success rate processing.

## Directory Structure

```
db/
├── mysql/
│   └── success-rate-queries/
│       └── bale/
│           └── bale.mysql.sql
├── postgres/
│   └── success-rate-queries/
│       └── bale/
│           └── bale.postgres.sql
└── README.md (this file)
```

## Success Rate Queries

### BALE Application

- **MySQL**: `mysql/success-rate-queries/bale/bale.mysql.sql`
- **PostgreSQL**: `postgres/success-rate-queries/bale/bale.postgres.sql`

These queries aggregate transaction data from `raw_bale` table and are used by the stored procedure `sp_process_bale_daily()`.

### Adding New Applications

To add a new application:

1. Create a new directory under `mysql/success-rate-queries/` and `postgres/success-rate-queries/`
2. Add the SQL query file (e.g., `cms.mysql.sql` and `cms.postgres.sql`)
3. Create a migration file in `src/migrations/` following the pattern:
   - `{timestamp}-Create{AppName}ProcessingProcedure.ts`
4. The migration should:
   - Create stored procedure `sp_process_{app_name}_daily()`
   - Setup event scheduler (MySQL) or scheduler job (PostgreSQL: app-level scheduler if enabled, otherwise pg_cron preferred, pgAgent fallback)

## Stored Procedures

Stored procedures are created via TypeORM migrations in `src/migrations/`. They are not stored in this directory but are referenced here for documentation.

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

## Installation and Setup

### MySQL

1. **Run Migration**:
   ```bash
   npm run migration:run
   ```

2. **Verify Event Scheduler**:
   ```sql
   SHOW VARIABLES LIKE 'event_scheduler';
   ```
   Should return `ON`. If not, enable it:
   ```sql
   SET GLOBAL event_scheduler = ON;
   ```

3. **Verify Event Created**:
   ```sql
   SHOW EVENTS LIKE 'evt_process_bale_daily';
   ```

4. **Manual Trigger** (for testing):
   ```sql
   CALL sp_process_bale_daily();
   ```

### PostgreSQL

Migration akan otomatis mencoba menggunakan scheduler yang tersedia dengan urutan prioritas:
1. **Application-Level Scheduler (node-cron)** - jika `USE_APP_LEVEL_SCHEDULER=true` (Recommended for Windows)
2. **pg_cron** (preferred) - jika extension tersedia
3. **pgAgent** (fallback) - jika pg_cron tidak tersedia
4. **Manual setup** - jika keduanya tidak tersedia

**Catatan**: Semua scheduler (app-level, pg_cron, pgAgent) menggunakan environment variable `BALE_PROCESSING_SCHEDULE` untuk konfigurasi schedule. Default: `1 0 * * *` (00:01 setiap hari).

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
   BALE_PROCESSING_SCHEDULE=1 0 * * *  # Optional, default: '1 0 * * *' (00:01 daily)
   ```
   
   **Cron Schedule Format** (`BALE_PROCESSING_SCHEDULE`):
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
   npm run migration:postgres:run
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

1. **Set environment variable** (optional, untuk custom schedule):
   ```env
   BALE_PROCESSING_SCHEDULE=1 0 * * *  # Default: 00:01 setiap hari
   ```

2. **Install pg_cron Extension** (if not already installed):
   ```sql
   CREATE EXTENSION IF NOT EXISTS pg_cron;
   ```
   Note: Requires PostgreSQL restart and `shared_preload_libraries = 'pg_cron'` in postgresql.conf

3. **Run Migration**:
   ```bash
   npm run migration:postgres:run
   ```

4. **Verify Function Created**:
   ```sql
   SELECT proname FROM pg_proc WHERE proname = 'sp_process_bale_daily';
   ```

5. **Verify Cron Job**:
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'process-bale-daily';
   ```

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
   npm run migration:postgres:run
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
   npm run migration:postgres:run
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

## Adding New Applications

To add processing for a new application (e.g., CMS):

1. **Create Query Files**:
   - `db/mysql/success-rate-queries/cms/cms.mysql.sql`
   - `db/postgres/success-rate-queries/cms/cms.postgres.sql`

2. **Create Migration**:
   - File: `src/migrations/{timestamp}-CreateCmsProcessingProcedure.ts`
   - Follow the pattern from `CreateBaleProcessingProcedure.ts`
   - Update procedure name: `sp_process_cms_daily()`
   - Update app_name: 'CMS'

3. **Run Migration**:
   ```bash
   npm run migration:run
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
