
-- ============================================================
-- Indexes for: dashboard_bale_korpora_dgod
-- Table:       public."GCM_AGCM_LOG_ACTV"  (physical bale_korpora_db)
-- Run these on bale_korpora_db as a superuser or table owner.
-- Use CONCURRENTLY to avoid locking the table in production.
-- After creating indexes, run: ANALYZE public."GCM_AGCM_LOG_ACTV";
-- ============================================================

-- Universal Time-Range Scan
-- Used by all panels (ACTN_DT range is the base predicate everywhere)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gcm_log_actv_actn_dt
ON public."GCM_AGCM_LOG_ACTV" ("ACTN_DT");

-- IS_ERR Equality + Date Range + AMT Covering
-- Supports: Sukses/Error counts, persentase, total_sukses/error,
--           volume SUM panels (index-only scan via INCLUDE)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gcm_log_actv_is_err_actn_dt
ON public."GCM_AGCM_LOG_ACTV" ("IS_ERR", "ACTN_DT")
INCLUDE ("AMT");

-- Top 10 Error Code Panels (error rows only)
-- Covering for error detail table: avoids heap fetch for all selected columns
-- Also covers TOP 10 Error bar chart when IS_ERR='Y' is present
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gcm_log_actv_err_detail_cover
ON public."GCM_AGCM_LOG_ACTV" ("ACTN_DT", "ERR_MAP_CD")
INCLUDE ("ERR_MAP_NM", "REF_NO", "ACTN_TYP_NM", "TRX_STS_NM")
WHERE "IS_ERR" = 'Y';

-- Top 10 Service Name Panel
-- GROUP BY SRVC_NM ORDER BY count DESC LIMIT 10 over ACTN_DT range
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gcm_log_actv_srvc_nm
ON public."GCM_AGCM_LOG_ACTV" ("ACTN_DT", "SRVC_NM");

-- ============================================================
-- Corporation Watchlist (dashboard_corp_watchlist)
-- Supports: Success Rate, Failure Rate, Volume, Timeseries
-- Leading equality on ACTN_BY_CUST_ID narrows to one corp
-- before the date range scan; INCLUDE enables index-only scans
-- for COUNT FILTER (IS_ERR) and SUM(AMT) without heap fetch.
-- ============================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gcm_log_actv_cust_id_actn_dt
ON public."GCM_AGCM_LOG_ACTV" ("ACTN_BY_CUST_ID", "ACTN_DT")
INCLUDE ("IS_ERR", "AMT");

-- After creation, refresh planner statistics:
-- ANALYZE public."GCM_AGCM_LOG_ACTV";

-- ── Validation queries (run on bale_korpora_db) ──────────────
-- 6.1 Confirm index exists:
-- SELECT indexname, indexdef FROM pg_indexes
-- WHERE schemaname = 'public'
--   AND tablename = 'GCM_AGCM_LOG_ACTV'
--   AND indexname = 'idx_gcm_log_actv_cust_id_actn_dt';
--
-- 6.2 Test Success Rate panel (should show Index Only Scan, Heap Fetches: 0):
-- EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
-- SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE "IS_ERR" = 'N') / NULLIF(COUNT(*), 0), 2) AS "Success Rate"
-- FROM public."GCM_AGCM_LOG_ACTV"
-- WHERE "ACTN_BY_CUST_ID" = 'USU123'
--   AND "ACTN_DT" >= ('2026-04-24 00:00:00'::timestamp + interval '7 hour')
--   AND "ACTN_DT" <= ('2026-04-24 23:59:59'::timestamp + interval '7 hour');
--
-- 6.3 Test Volume panel (should show Index Only Scan, AMT from INCLUDE):
-- EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
-- SELECT SUM("AMT") AS "Volume"
-- FROM public."GCM_AGCM_LOG_ACTV"
-- WHERE "ACTN_BY_CUST_ID" = 'EDIK'
--   AND "ACTN_DT" >= ('2026-04-24 00:00:00'::timestamp + interval '7 hour')
--   AND "ACTN_DT" <= ('2026-04-24 23:59:59'::timestamp + interval '7 hour');
--
-- 6.4 Test Timeseries panel (should show Index Only Scan, Heap Fetches: 0):
-- EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
-- SELECT date_trunc('minute', "ACTN_DT" - interval '7 hour') AS time,
--        COUNT(*) AS "Total",
--        ROUND(100.0 * COUNT(*) FILTER (WHERE "IS_ERR" = 'N') / NULLIF(COUNT(*), 0), 2) AS "Success Rate"
-- FROM public."GCM_AGCM_LOG_ACTV"
-- WHERE "ACTN_BY_CUST_ID" = 'FATMAWATI1'
--   AND "ACTN_DT" >= ('2026-04-24 00:00:00'::timestamp + interval '7 hour')
--   AND "ACTN_DT" <= ('2026-04-24 23:59:59'::timestamp + interval '7 hour')
-- GROUP BY 1 ORDER BY 1;
