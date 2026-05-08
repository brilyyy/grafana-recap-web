-- Indexes for dashboard_edc_agen_dgod
-- Main hot path:
--   TRPROD = 'POS'
--   TRTRTY NOT IN ('21','6A','6B','C1','C2')
--   JOIN ASID160448_ZRSPCD0P by TRRSPC = RSRSPC
--   LEFT JOIN response_code_dictionary by rc + id_app_identifier IN (7, 61)

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_itm_ztrans0p_edc_agen_main
ON public."ASID160448_ZTRANS0P" ("TRPROD", "TRTRTY", "TRRSPC")
INCLUDE ("TRSTAN", "TRXMDT", "TRXMTM", "TRRRF#", "TRTRN$")
WHERE "TRPROD" = 'POS';

ANALYZE public."ASID160448_ZTRANS0P";

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_itm_zrspcd0p_rsrspc_lookup
ON public."ASID160448_ZRSPCD0P" ("RSRSPC")
INCLUDE ("RSSHTD");

ANALYZE public."ASID160448_ZRSPCD0P";

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rcd_lookup_app7_61
ON public.response_code_dictionary (id_app_identifier, rc)
INCLUDE (error_type, rc_description)
WHERE id_app_identifier IN (7, 61);

ANALYZE public.response_code_dictionary;

-- ============================================================
-- Index impact analysis
-- ============================================================

-- 1) Verify indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND (
    (tablename = 'ASID160448_ZTRANS0P' AND indexname = 'idx_itm_ztrans0p_edc_agen_main')
    OR (tablename = 'ASID160448_ZRSPCD0P' AND indexname = 'idx_itm_zrspcd0p_rsrspc_lookup')
    OR (tablename = 'response_code_dictionary' AND indexname = 'idx_rcd_lookup_app7_61')
  );

-- 2) Main access path check
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT tr."TRRSPC", tr."TRSTAN", tr."TRXMDT", tr."TRXMTM"
FROM public."ASID160448_ZTRANS0P" tr
WHERE tr."TRPROD" = 'POS'
  AND tr."TRTRTY" NOT IN ('21','6A','6B','C1','C2')
LIMIT 10000;
