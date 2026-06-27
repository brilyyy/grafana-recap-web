-- Core application tables. Idempotent (CREATE TABLE IF NOT EXISTS + drop/create triggers).
-- Column additions to pre-existing tables are handled by the engine's reconciliation pass
-- (MANAGED_COLUMNS), not here — these definitions are the desired fresh-install state.

-- ── app_identifier ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "app_identifier" (
  "id"              SERIAL PRIMARY KEY,
  "app_name"        VARCHAR(255) NOT NULL UNIQUE,
  "db_name"         VARCHAR(255),
  "raw_table_name"  VARCHAR(255),
  "retention_days"  INTEGER,
  "created_at"      TIMESTAMP DEFAULT NOW() NOT NULL,
  "updated_at"      TIMESTAMP DEFAULT NOW() NOT NULL
);
DROP TRIGGER IF EXISTS "upd_app_identifier_updated_at" ON "app_identifier";
CREATE TRIGGER "upd_app_identifier_updated_at"
  BEFORE UPDATE ON "app_identifier"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── app_mappings ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "app_mappings" (
  "id"                  SERIAL PRIMARY KEY,
  "id_app_identifier"   INTEGER NOT NULL REFERENCES "app_identifier"("id") ON DELETE CASCADE,
  "generate_from"       VARCHAR(10) NOT NULL DEFAULT 'db',
  "fields"              JSONB NOT NULL DEFAULT '{"date":"tanggal_transaksi","response_code":"rc","response_code_desc":"rc_description","error_type":"error_type","trx_count":"total_transaksi","trx_feature":"jenis_transaksi"}',
  "success_type_format" JSONB NOT NULL DEFAULT '["Sukses"]',
  "error_type_format"   JSONB NOT NULL DEFAULT '{"system_error":["S","#N/A"],"business_error":["N","B"]}',
  "ignore_errors"       TEXT[] DEFAULT '{}',
  "ignore_features"     TEXT[] DEFAULT '{}',
  "created_at"          TIMESTAMP DEFAULT NOW() NOT NULL,
  "updated_at"          TIMESTAMP DEFAULT NOW() NOT NULL,
  CONSTRAINT "unique_app_mapping" UNIQUE ("id_app_identifier")
);
DROP TRIGGER IF EXISTS "upd_app_mappings_updated_at" ON "app_mappings";
CREATE TRIGGER "upd_app_mappings_updated_at"
  BEFORE UPDATE ON "app_mappings"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── fdw_source_table ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "fdw_source_table" (
  "id"              SERIAL PRIMARY KEY,
  "source_db_name"  VARCHAR(255) NOT NULL,
  "table_name"      VARCHAR(255) NOT NULL,
  "schema_name"     VARCHAR(255) DEFAULT 'public',
  "host"            VARCHAR(255) DEFAULT NULL,
  "created_at"      TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE("source_db_name", "table_name")
);

-- ALTER TABLE fdw_source_table ADD COLUMN host VARCHAR(255) DEFAULT NULL;

-- ── raw_table_housekeeping ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "raw_table_housekeeping" (
  "id"               SERIAL PRIMARY KEY,
  "db_name"          VARCHAR(255) NOT NULL,
  "table_name"       VARCHAR(255) NOT NULL,
  "date_column"      VARCHAR(255),
  "date_column_type" VARCHAR(50) DEFAULT 'timestamp',
  "retention_days"   INTEGER,
  "notes"            VARCHAR(500),
  "created_at"       TIMESTAMP DEFAULT NOW() NOT NULL,
  "updated_at"       TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE("db_name", "table_name")
);
DROP TRIGGER IF EXISTS "upd_raw_table_housekeeping_updated_at" ON "raw_table_housekeeping";
CREATE TRIGGER "upd_raw_table_housekeeping_updated_at"
  BEFORE UPDATE ON "raw_table_housekeeping"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── app_custom_procedure ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "app_custom_procedure" (
  "id"                 SERIAL PRIMARY KEY,
  "id_app_identifier"  INTEGER NOT NULL REFERENCES "app_identifier"("id") ON DELETE CASCADE,
  "function_name"      VARCHAR(63) NOT NULL UNIQUE,
  "recap_kind"         VARCHAR(64) NOT NULL DEFAULT 'success_rate_daily',
  "output_table"       VARCHAR(255) NOT NULL DEFAULT 'app_success_rate',
  "schedule_cron"      VARCHAR(64),
  "description"        VARCHAR(500),
  "sql_text"           TEXT NOT NULL,
  "created_at"         TIMESTAMP DEFAULT NOW() NOT NULL,
  "updated_at"         TIMESTAMP DEFAULT NOW() NOT NULL
);
DROP TRIGGER IF EXISTS "upd_app_custom_procedure_updated_at" ON "app_custom_procedure";
CREATE TRIGGER "upd_app_custom_procedure_updated_at"
  BEFORE UPDATE ON "app_custom_procedure"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── app_success_rate ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "app_success_rate" (
  "id"                  SERIAL PRIMARY KEY,
  "id_app_identifier"   INTEGER NOT NULL REFERENCES "app_identifier"("id") ON DELETE CASCADE,
  "tanggal_transaksi"   DATE NOT NULL,
  "bulan"               VARCHAR(20) NOT NULL,
  "tahun"               INTEGER NOT NULL,
  "jenis_transaksi"     VARCHAR(255) NOT NULL,
  "rc"                  VARCHAR(255),
  "rc_description"      VARCHAR(500),
  "total_transaksi"     INTEGER,
  "total_nominal"       DECIMAL(20,2),
  "total_biaya_admin"   DECIMAL(20,2),
  "status_transaksi"    VARCHAR(255),
  "error_type"          "error_type_enum",
  "created_at"          TIMESTAMP DEFAULT NOW() NOT NULL,
  "updated_at"          TIMESTAMP DEFAULT NOW() NOT NULL
);
DROP TRIGGER IF EXISTS "upd_app_success_rate_updated_at" ON "app_success_rate";
CREATE TRIGGER "upd_app_success_rate_updated_at"
  BEFORE UPDATE ON "app_success_rate"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── response_code_dictionary ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "response_code_dictionary" (
  "id"                INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "id_app_identifier" INTEGER NOT NULL REFERENCES "app_identifier"("id") ON DELETE CASCADE,
  "jenis_transaksi"   VARCHAR(255),
  "rc"                VARCHAR(255),
  "rc_description"    VARCHAR(500),
  "error_type"        "error_type_enum" NOT NULL,
  CONSTRAINT "unique_dictionary_entry" UNIQUE ("id_app_identifier","jenis_transaksi","rc")
);

-- ── unmapped_rc ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "unmapped_rc" (
  "id"                INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "id_app_identifier" INTEGER NOT NULL REFERENCES "app_identifier"("id") ON DELETE CASCADE,
  "jenis_transaksi"   VARCHAR(255),
  "rc"                VARCHAR(255),
  "rc_description"    VARCHAR(500),
  "status_transaksi"  VARCHAR(255),
  "error_type"        "error_type_enum",
  "created_at"        TIMESTAMP DEFAULT NOW() NOT NULL,
  CONSTRAINT "unique_unmapped_rc_entry" UNIQUE ("id_app_identifier","jenis_transaksi","rc")
);
