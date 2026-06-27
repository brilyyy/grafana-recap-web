-- Custom recap output tables (CORP × jenis × RC × status grain). Idempotent.
-- Legacy-table column/constraint upgrades are handled by the engine reconciliation pass.

CREATE TABLE IF NOT EXISTS "recap_cms_corp_daily" (
  "id"                  SERIAL PRIMARY KEY,
  "id_app_identifier"   INTEGER NOT NULL REFERENCES "app_identifier"("id") ON DELETE CASCADE,
  "tanggal_transaksi"   DATE NOT NULL,
  "corp_id"             VARCHAR(255) NOT NULL,
  "jenis_transaksi"     VARCHAR(1024) NOT NULL,
  "rc"                  VARCHAR(255) NOT NULL,
  "rc_description"      TEXT NOT NULL,
  "status_transaksi"    VARCHAR(64) NOT NULL,
  "error_type"          "error_type_enum",
  "total_transaksi"     INTEGER DEFAULT 0,
  "total_nominal"       DECIMAL(20, 2) DEFAULT 0,
  "created_at"          TIMESTAMP DEFAULT NOW() NOT NULL,
  "updated_at"          TIMESTAMP DEFAULT NOW() NOT NULL,
  CONSTRAINT "recap_cms_corp_daily_grain_key" UNIQUE (
    "id_app_identifier",
    "tanggal_transaksi",
    "corp_id",
    "jenis_transaksi",
    "rc",
    "rc_description",
    "status_transaksi"
  )
);
DROP TRIGGER IF EXISTS "upd_recap_cms_corp_daily_updated_at" ON "recap_cms_corp_daily";
CREATE TRIGGER "upd_recap_cms_corp_daily_updated_at"
  BEFORE UPDATE ON "recap_cms_corp_daily"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS "recap_bale_korpora_corp_daily" (
  "id"                  SERIAL PRIMARY KEY,
  "id_app_identifier"   INTEGER NOT NULL REFERENCES "app_identifier"("id") ON DELETE CASCADE,
  "tanggal_transaksi"   DATE NOT NULL,
  "corp_id"             VARCHAR(255) NOT NULL,
  "jenis_transaksi"     VARCHAR(1024) NOT NULL,
  "rc"                  VARCHAR(255) NOT NULL,
  "rc_description"      TEXT NOT NULL,
  "status_transaksi"    VARCHAR(64) NOT NULL,
  "error_type"          "error_type_enum",
  "total_transaksi"     INTEGER DEFAULT 0,
  "total_nominal"       DECIMAL(20, 2) DEFAULT 0,
  "created_at"          TIMESTAMP DEFAULT NOW() NOT NULL,
  "updated_at"          TIMESTAMP DEFAULT NOW() NOT NULL,
  CONSTRAINT "recap_bale_korpora_corp_daily_grain_key" UNIQUE (
    "id_app_identifier",
    "tanggal_transaksi",
    "corp_id",
    "jenis_transaksi",
    "rc",
    "rc_description",
    "status_transaksi"
  )
);
DROP TRIGGER IF EXISTS "upd_recap_bale_korpora_corp_daily_updated_at" ON "recap_bale_korpora_corp_daily";
CREATE TRIGGER "upd_recap_bale_korpora_corp_daily_updated_at"
  BEFORE UPDATE ON "recap_bale_korpora_corp_daily"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
