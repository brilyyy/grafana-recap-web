-- Detail Watchlist (Top ERR Name panel):
-- Filter: ACTN_BY_CUST_ID + ACTN_DT range + IS_ERR='Y'
-- Group by ERR_MAP_CD then join to host error mapping by CD.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gcm_log_actv_cust_dt_err_y
ON public."GCM_AGCM_LOG_ACTV" ("ACTN_BY_CUST_ID", "ACTN_DT", "ERR_MAP_CD")
WHERE "IS_ERR" = 'Y';

-- Lookup index for mapping table join key (CD -> NM).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gcm_host_error_mapping_cd
ON public."GCM_AGCM_HOST_ERROR_MAPPING" ("CD")
INCLUDE ("NM");


ANALYZE public."GCM_AGCM_HOST_ERROR_MAPPING";
