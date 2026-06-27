-- All performance indexes. Runs after the schema phase (so reconciliation-added
-- columns like recap_kind / catalog_entry_id exist). Every index is idempotent.
-- The unique_dictionary_entry / *_grain_key uniques are table CONSTRAINTS, defined
-- with their tables, not here.

-- app_identifier
CREATE INDEX IF NOT EXISTS "idx_app_name" ON "app_identifier" ("app_name");

-- app_mappings
CREATE INDEX IF NOT EXISTS "idx_app_mappings_id_app_identifier" ON "app_mappings" ("id_app_identifier");

-- app_success_rate
CREATE INDEX IF NOT EXISTS "idx_tanggal_transaksi" ON "app_success_rate" ("tanggal_transaksi");
CREATE INDEX IF NOT EXISTS "idx_id_app_identifier" ON "app_success_rate" ("id_app_identifier");
CREATE INDEX IF NOT EXISTS "idx_app_success_rate_id_app_jenis_transaksi" ON "app_success_rate" ("id_app_identifier", "jenis_transaksi");
CREATE INDEX IF NOT EXISTS "idx_app_success_rate_id_app_rc" ON "app_success_rate" ("id_app_identifier", "rc");
CREATE INDEX IF NOT EXISTS "idx_app_success_rate_id_app_error_type" ON "app_success_rate" ("id_app_identifier", "error_type");
CREATE INDEX IF NOT EXISTS "idx_app_success_rate_id_app_bulan_tahun" ON "app_success_rate" ("id_app_identifier", "bulan", "tahun");
CREATE INDEX IF NOT EXISTS "idx_app_success_rate_rc" ON "app_success_rate" ("rc");

-- response_code_dictionary
CREATE INDEX IF NOT EXISTS "idx_rcd_id_app_error_type" ON "response_code_dictionary" ("id_app_identifier", "error_type");
CREATE INDEX IF NOT EXISTS "idx_rcd_jenis_transaksi" ON "response_code_dictionary" ("jenis_transaksi");

-- unmapped_rc
CREATE INDEX IF NOT EXISTS "idx_unmapped_rc_id_app_identifier" ON "unmapped_rc" ("id_app_identifier");

-- users
CREATE INDEX IF NOT EXISTS "idx_username" ON "users" ("username");
CREATE INDEX IF NOT EXISTS "idx_email" ON "users" ("email");

-- audit_logs
CREATE INDEX IF NOT EXISTS "idx_audit_user_id" ON "audit_logs" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_audit_action" ON "audit_logs" ("action");
CREATE INDEX IF NOT EXISTS "idx_audit_resource_type" ON "audit_logs" ("resource_type");
CREATE INDEX IF NOT EXISTS "idx_audit_created_at" ON "audit_logs" ("created_at");

-- rate_limit_logs
CREATE INDEX IF NOT EXISTS "idx_ip_endpoint" ON "rate_limit_logs" ("ip_address", "endpoint");
CREATE INDEX IF NOT EXISTS "idx_blocked_at" ON "rate_limit_logs" ("blocked_at");

-- pending_user_requests
CREATE INDEX IF NOT EXISTS "idx_pur_status" ON "pending_user_requests" ("status");
CREATE INDEX IF NOT EXISTS "idx_pur_requested_by" ON "pending_user_requests" ("requested_by");

-- app_processing_log
CREATE INDEX IF NOT EXISTS "idx_app_processing_date" ON "app_processing_log" ("app_name", "processing_date");
CREATE INDEX IF NOT EXISTS "idx_apl_status" ON "app_processing_log" ("status", "created_at");
CREATE INDEX IF NOT EXISTS "idx_app_processing_log_processing_date" ON "app_processing_log" ("processing_date");
CREATE INDEX IF NOT EXISTS "idx_apl_recap_kind_date" ON "app_processing_log" ("recap_kind", "processing_date");
CREATE INDEX IF NOT EXISTS "idx_apl_catalog_entry_date" ON "app_processing_log" ("catalog_entry_id", "processing_date");

-- recap models
CREATE INDEX IF NOT EXISTS "idx_recap_cms_corp_daily_app_date" ON "recap_cms_corp_daily" ("id_app_identifier", "tanggal_transaksi");
CREATE INDEX IF NOT EXISTS "idx_recap_cms_corp_daily_app_date_corp" ON "recap_cms_corp_daily" ("id_app_identifier", "tanggal_transaksi", "corp_id");
CREATE INDEX IF NOT EXISTS "idx_recap_bk_corp_daily_app_date" ON "recap_bale_korpora_corp_daily" ("id_app_identifier", "tanggal_transaksi");
CREATE INDEX IF NOT EXISTS "idx_recap_bk_corp_daily_app_date_corp" ON "recap_bale_korpora_corp_daily" ("id_app_identifier", "tanggal_transaksi", "corp_id");
