
-- ============================================================
-- Indexes for: dashboard_cms_dgod
-- Table:       public."GCM_AGCM_LOG_ACTV"  (physical cms_db)
-- Run these on the physical cms_db as a superuser or table owner.
-- Use CONCURRENTLY to avoid locking the table in production.
-- After creating indexes, run: ANALYZE public."GCM_AGCM_LOG_ACTV";
-- Note: CMS queries use bare timestamp (no +7h offset) for ACTN_DT.
-- ============================================================

-- Universal Time-Range Scan
-- Used by all panels (ACTN_DT range is the base predicate everywhere)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cms_gcm_log_actv_actn_dt
ON public."GCM_AGCM_LOG_ACTV" ("ACTN_DT");

-- IS_ERR Equality + Date Range
-- Supports: Success %, Error %, pie split, count/sum aggregates with IS_ERR filter
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cms_gcm_log_actv_is_err_actn_dt
ON public."GCM_AGCM_LOG_ACTV" ("IS_ERR", "ACTN_DT");

-- IDR Amount Volume Panels
-- Covers SUM("AMT") WHERE IS_ERR='N'/'Y' AND AMT_CCY_CD='IDR' with index-only scan
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cms_gcm_log_actv_amt_ccy_dt
ON public."GCM_AGCM_LOG_ACTV" ("AMT_CCY_CD", "IS_ERR", "ACTN_DT")
INCLUDE ("AMT");

-- Top 10 Error Map Code Panel
-- GROUP BY ERR_MAP_CD ORDER BY count DESC LIMIT 10 over ACTN_DT range
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cms_gcm_log_actv_err_map_cd_dt
ON public."GCM_AGCM_LOG_ACTV" ("ACTN_DT", "ERR_MAP_CD");

-- Service Name Grouped Panels (Single / Payroll / Bulk table panels)
-- GROUP BY SRVC_NM over ACTN_DT range (with ACTN_TYP_NM ILIKE filter in coordinator)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cms_gcm_log_actv_srvc_nm_dt
ON public."GCM_AGCM_LOG_ACTV" ("ACTN_DT", "SRVC_NM");

-- BULK / Payroll Detail Panels (STRING_AGG DISTINCT pattern)
-- GROUP BY (ACTN_BY_CUST_ID, SRVC_NM) with IS_ERR and TRX_STS_NM in SELECT
-- INCLUDE avoids heap fetch for all selected columns in the detail query
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cms_gcm_log_actv_bulk_detail
ON public."GCM_AGCM_LOG_ACTV" ("ACTN_DT", "ACTN_BY_CUST_ID", "SRVC_NM")
INCLUDE ("IS_ERR", "TRX_STS_NM", "ACTN_TYP_NM");

-- ACTN_TYP_NM Panels (Top 5 Type + full type table)
-- Panels filter WHERE ACTN_TYP_NM IS NOT NULL + time range after optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cms_gcm_log_actv_actn_typ_nm_dt
ON public."GCM_AGCM_LOG_ACTV" ("ACTN_DT", "ACTN_TYP_NM")
WHERE "ACTN_TYP_NM" IS NOT NULL;

-- Optional: GIN trigram indexes for ILIKE '%...%' text filters
-- Enable only if pg_trgm extension is available and ILIKE panels remain slow after btree indexes.
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cms_gcm_log_actv_srvc_nm_trgm
-- ON public."GCM_AGCM_LOG_ACTV" USING gin ("SRVC_NM" gin_trgm_ops);
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cms_gcm_log_actv_actn_typ_nm_trgm
-- ON public."GCM_AGCM_LOG_ACTV" USING gin ("ACTN_TYP_NM" gin_trgm_ops);
