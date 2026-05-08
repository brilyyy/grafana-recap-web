-- ============================================================
-- Indexes for: dashboard_corp_watchlist
-- Table:       public."GCM_AGCM_LOG_ACTV" (physical bale_korpora_db)
-- Run on bale_korpora_db as table owner/superuser.
-- Use CONCURRENTLY to reduce write blocking in production.
-- ============================================================

-- Corporation Watchlist:
-- Leading equality predicate on ACTN_BY_CUST_ID + ACTN_DT time range.
-- INCLUDE ("IS_ERR","AMT") supports index-only scans for:
-- - success/failure rate (COUNT FILTER on IS_ERR)
-- - total volume (SUM(AMT))
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gcm_log_actv_cust_id_actn_dt
ON public."GCM_AGCM_LOG_ACTV" ("ACTN_BY_CUST_ID", "ACTN_DT")
INCLUDE ("IS_ERR", "AMT");

-- Refresh planner statistics after index creation.
ANALYZE public."GCM_AGCM_LOG_ACTV";
