# Server Configuration Guide

This document describes how to configure the database server (PostgreSQL) for the Dashboard Grafana platform, especially for pg_cron scheduled jobs.

> **Note:** MySQL and pgAgent are deprecated. Use PostgreSQL + pg_cron as the supported setup.

## PostgreSQL Server Setup (pg_cron)

When using **pg_cron** for scheduled processing (e.g. Bale daily processing), the PostgreSQL server must be configured correctly. Otherwise jobs may fail with `connection failed` in `cron.job_run_details`.

### 1. postgresql.conf

Add or modify these settings in `postgresql.conf`:

```conf
# Required: Load pg_cron on startup
shared_preload_libraries = 'pg_cron'

# Recommended: Use background workers instead of opening new connections
# This avoids "connection failed" when pg_cron runs jobs in other databases
cron.use_background_workers = on

# May need to increase if you run many concurrent cron jobs (default: 8)
max_worker_processes = 20

# Optional: Database where pg_cron metadata lives (default: postgres)
# cron.database_name = 'postgres'

# Required for Asia/Jakarta (UTC+7): pg_cron defaults to GMT; without this, schedule runs 7 hours late
cron.timezone = 'Asia/Jakarta'
```

**Note:** `cron.use_background_workers`, `shared_preload_libraries`, and `cron.timezone` require a **PostgreSQL restart** to take effect.

### 2. pg_hba.conf (if NOT using background workers)

If you use the default connection-based mode (libpq), pg_cron opens a new connection to run each job. Ensure `pg_hba.conf` allows that connection without a password:

```conf
# Local connections (same container)
host    platform_db     postgres    127.0.0.1/32    trust
host    platform_db_dev postgres    127.0.0.1/32    trust

# Docker bridge network (if DB is in Docker)
host    platform_db     postgres    172.17.0.0/16   trust
host    platform_db_dev postgres    172.17.0.0/16   trust
```

Reload after changes:

```sql
SELECT pg_reload_conf();
```

### 3. Docker

If PostgreSQL runs in Docker:

1. **Find postgresql.conf** (often inside the container):
   ```bash
   docker exec <postgres-container> cat /var/lib/postgresql/data/postgresql.conf | grep -E "shared_preload|cron\.|max_worker"
   ```

2. **Edit** via volume mount or `docker exec`:
   ```bash
   docker exec -it <postgres-container> bash
   # Edit /var/lib/postgresql/data/postgresql.conf
   ```

3. **Restart** the container:
   ```bash
   docker restart <postgres-container>
   ```

### 4. Verify Configuration

After restart:

```sql
SELECT name, setting FROM pg_settings 
WHERE name IN ('shared_preload_libraries', 'cron.use_background_workers', 'max_worker_processes', 'cron.timezone');
```

Expected:
- `shared_preload_libraries` includes `pg_cron`
- `cron.use_background_workers` = `on`
- `cron.timezone` = `Asia/Jakarta` (for UTC+7)

### 5. Troubleshooting "connection failed"

| Symptom | Solution |
|---------|----------|
| `cron.job_run_details` shows `status='failed'`, `return_message='connection failed'` | Enable `cron.use_background_workers = on` and restart PostgreSQL |
| Cannot add `cron.use_background_workers` | Add it manually to `postgresql.conf`; it is not present by default |
| Jobs still fail after restart | Check `pg_hba.conf` allows connections from localhost/127.0.0.1 with trust |
| DB on remote host (e.g. 172.17.7.74) | Migration sets `nodename`/`nodeport` from `DB_HOST`/`DB_PORT`; ensure migration ran with correct env |
| Jobs run at wrong time (e.g. 7 hours late) | Set `cron.timezone = 'Asia/Jakarta'` in postgresql.conf; pg_cron defaults to GMT |

### 6. Migration Environment

When running migration (cron phase), ensure `DB_HOST` and `DB_PORT` match your production database:

```bash
DB_NAME=postgres DB_HOST=your-db-host DB_PORT=5432 npm run db:migrate:cron
```

Or in migration-kit `.env`:

```env
DB_NAME=postgres
DB_HOST=172.17.7.74
DB_PORT=5432
```

## MySQL Server Setup

For MySQL, the event scheduler must be enabled:

```sql
SET GLOBAL event_scheduler = ON;
```

To persist across restarts, add to `my.cnf`:

```ini
[mysqld]
event_scheduler = ON
```

No additional server configuration is required for the scheduled procedures.
