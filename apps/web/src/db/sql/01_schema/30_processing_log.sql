-- app_processing_log. recap_kind / catalog_entry_id are included for fresh installs;
-- the engine reconciliation pass adds them (and backfills catalog_entry_id) on upgrades.

CREATE TABLE IF NOT EXISTS "app_processing_log" (
  "id"                SERIAL PRIMARY KEY,
  "app_name"          VARCHAR(255) NOT NULL,
  "id_app_identifier" INTEGER NOT NULL REFERENCES "app_identifier"("id") ON DELETE CASCADE,
  "processing_date"   DATE NOT NULL,
  "start_time"        TIMESTAMP NOT NULL,
  "end_time"          TIMESTAMP,
  "status"            "proc_status_enum" NOT NULL,
  "records_processed" INTEGER DEFAULT 0,
  "records_inserted"  INTEGER DEFAULT 0,
  "records_skipped"   INTEGER DEFAULT 0,
  "error_message"     TEXT,
  "recap_kind"        VARCHAR(64) NOT NULL DEFAULT 'success_rate_daily',
  "catalog_entry_id"  VARCHAR(128),
  "created_at"        TIMESTAMP DEFAULT NOW() NOT NULL
);
