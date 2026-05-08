-- Indexes for dashboard_debit_online
-- Main hot path:
--   TRTRTY = '21' AND TRPCCD = 59
--   JOIN response_code_dictionary by TRRSPC = rc and id_app_identifier = 6

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_itm_ztrans0p_debit_online_main
ON public."ASID160448_ZTRANS0P" ("TRTRTY", "TRPCCD", "TRRSPC")
INCLUDE ("TRXMDT", "TRXMTM", "TRSTAN");

ANALYZE public."ASID160448_ZTRANS0P";

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rcd_lookup_app6
ON public.response_code_dictionary (id_app_identifier, rc)
INCLUDE (error_type, rc_description);

ANALYZE public.response_code_dictionary;

-- ============================================================
-- Index impact analysis
-- ============================================================

-- 1) Verify indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND (
    (tablename = 'ASID160448_ZTRANS0P' AND indexname = 'idx_itm_ztrans0p_debit_online_main')
    OR (tablename = 'response_code_dictionary' AND indexname = 'idx_rcd_lookup_app6')
  );

-- 2) Main access path check
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT itm."TRRSPC", itm."TRXMDT", itm."TRXMTM", itm."TRSTAN"
FROM public."ASID160448_ZTRANS0P" itm
WHERE itm."TRTRTY" = '21'
  AND itm."TRPCCD" = 59
LIMIT 10000;
