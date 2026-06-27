-- ============================================================
-- Indexes for: dashboard_daily_monitoring
-- This file covers all physical source databases accessed
-- via FDW from dbs_db and bale_db Grafana datasources.
--
-- Run each section on the indicated PHYSICAL database.
-- Use CONCURRENTLY to avoid write-blocking in production.
-- Run ANALYZE on the table after every CREATE INDEX.
-- ============================================================


-- ============================================================
-- SECTION 1: bale_db  →  public.raw_bale
-- Panels: Bale by BTN recap stats, timeseries (Jumlah Trx,
--         Success Rate, TPS)
-- Physical filters used:
--   transaction_state IN ('1','9','8')
--   transaction_date  BETWEEN (timeFrom+7h) AND (timeTo+7h)
--   transaction_category = ANY(ARRAY[...])   -- large IN-list
-- Join: response_code_dictionary (rc, jenis_transaksi, id=1)
-- ============================================================

-- NOTE: The indexes below should already exist from
-- dashboard_bale_dgod work. Run the verification query
-- in Section 6 before creating to avoid duplicates.

-- Primary scan path: category equality + date range
-- Covers transaction_id (COUNT DISTINCT) and result_code (JOIN)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_raw_bale_active_cat_date
ON public.raw_bale (transaction_category, transaction_date)
INCLUDE (transaction_id, transaction_amount, result_code)
WHERE transaction_state IN ('1','9','8');

-- Secondary lookup for CTE top-error detail
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_raw_bale_rc_cat_date
ON public.raw_bale (result_code, transaction_category, transaction_date)
INCLUDE (esb_ref_no, transaction_id)
WHERE result_code IS NOT NULL
  AND transaction_state IN ('1','9','8');

ANALYZE public.raw_bale;


-- ============================================================
-- SECTION 2: bale_bisnis_db  →  public.raw_bale_bisnis
-- Panels: Bale Bisnis recap stats, timeseries
-- Physical filters used:
--   transaction_state  IN ('0','1','2','3','4')
--   transaction_status IN ('0','1','2','3','4')
--   transaction_date   >= (timeFrom+7h) AND <= (timeTo+7h)
-- Join: response_code_dictionary (rc, jenis_transaksi, id=2)
-- ============================================================

-- Primary scan: date range first (most selective for time-based
-- dashboards), then state/status equality filters.
-- INCLUDE covers transaction_id (COUNT DISTINCT), result_code
-- and transaction_category (JOIN to response_code_dictionary).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_raw_bale_bisnis_date_state_status
ON public.raw_bale_bisnis (transaction_date, transaction_state, transaction_status)
INCLUDE (transaction_id, result_code, transaction_category);

ANALYZE public.raw_bale_bisnis;


-- ============================================================
-- SECTION 3: itm_db  →  public."ASID160448_ZTRANS0P"
-- Panels: EDC Agent recap/timeseries, EDC Merchant recap/
--         timeseries, EDC BTN Merchant recap/timeseries
-- Physical filters used:
--   "TRTRTY" NOT IN ('21','6A','6B','C1','C2')  -- Agent
--   "TRTRTY" = '21'                             -- Merchant/BTN
--   "TRPROD" = 'POS'
--   "TRCAID" IN (...)                           -- BTN Merchant
-- NOTE: Time is derived via TO_TIMESTAMP(SUBSTRING(TRXMDT)...)
--   so time cannot be pushed to physical indexes directly.
--   Physical indexes reduce rows BEFORE the expensive
--   TO_TIMESTAMP computation runs in Grafana/FDW.
-- ============================================================

-- Agent panels: TRTRTY NOT IN + TRPROD equality
-- Index optimizer may use this even for NOT IN via exclusion.
-- Create as a partial index excluding the Merchant-only value
-- to keep index smaller and more cache-friendly.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ztrans0p_trprod_trtrty
ON public."ASID160448_ZTRANS0P" ("TRPROD", "TRTRTY")
INCLUDE ("TRXMDT", "TRXMTM", "TRRSPC", "TRSTAN");

-- Merchant panels: TRTRTY = '21' + TRPROD = 'POS'
-- Partial index for the exact merchant predicate subset
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ztrans0p_merchant
ON public."ASID160448_ZTRANS0P" ("TRPROD", "TRCAID")
INCLUDE ("TRXMDT", "TRXMTM", "TRRSPC", "TRSTAN", "TRTRTY")
WHERE "TRTRTY" = '21';

ANALYZE public."ASID160448_ZTRANS0P";


-- ============================================================
-- SECTION 4: itm_db  →  public."ASID160448_ZRSPCD0P"
-- Panels: EDC Agent/Merchant/BTN timeseries (JOIN for RC label)
-- Join key: tr."TRRSPC" = r."RSRSPC"
-- Selected column: r."RSSHTD" (description label)
-- ============================================================

-- Lookup index: index-only scan for JOIN + INCLUDE description
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_zrspcd0p_rsrspc
ON public."ASID160448_ZRSPCD0P" ("RSRSPC")
INCLUDE ("RSSHTD");

ANALYZE public."ASID160448_ZRSPCD0P";


-- ============================================================
-- SECTION 5: itm_db  →  public."ASID160448_ZTRANS0P"
-- (Different physical database than Section 3 despite same name)
-- Panels: ITM Jumlah Trx stat, TPS stat, Success Rate stat,
--         timeseries (Jumlah Transaksi + Success Rate)
-- Physical filters used:
--   "TRTRTY" = '21'
--   "TRPCCD" = 59
-- NOTE: Time derived from TRTDAT/TRTTIM text fields via
--   TO_TIMESTAMP(SUBSTRING(...)) — same pushdown limitation
--   as Section 3.
-- Join: response_code_dictionary (rc, id_app_identifier=6)
-- ============================================================

-- Composite equality: TRTRTY + TRPCCD narrow to target subset
-- INCLUDE datetime text fields to allow index-only scan before
-- the expensive TO_TIMESTAMP conversion
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_itm_ztrans0p_trtrty_trpccd
ON public."ASID160448_ZTRANS0P" ("TRTRTY", "TRPCCD")
INCLUDE ("TRTDAT", "TRTTIM", "TRRSPC");

ANALYZE public."ASID160448_ZTRANS0P";


-- ============================================================
-- SECTION 6: dbs_db  →  public.response_code_dictionary
-- Used by all sections as enrichment JOIN
-- Join keys: rc, jenis_transaksi, id_app_identifier
-- ============================================================

-- NOTE: This index should already exist from dashboard_bale_dgod.
-- Verify before creating to avoid duplicates.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rcd_lookup
ON public.response_code_dictionary (rc, jenis_transaksi, id_app_identifier)
INCLUDE (error_type);

ANALYZE public.response_code_dictionary;


-- ============================================================
-- SECTION 7: VALIDATION PLAYBOOK
-- Run these AFTER creating indexes and ANALYZE.
-- Run on the PHYSICAL database for true index confirmation.
-- For FDW panels (running from dbs_db or bale_db Grafana DS),
-- also check EXPLAIN output for "Remote SQL" predicate pushdown.
-- ============================================================

-- ── 7.1 Confirm indexes exist ────────────────────────────────

-- On bale_db:
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public' AND tablename = 'raw_bale'
--   AND indexname IN (
--     'idx_raw_bale_active_cat_date',
--     'idx_raw_bale_rc_cat_date'
--   );

-- On bale_bisnis_db:
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public' AND tablename = 'raw_bale_bisnis'
--   AND indexname = 'idx_raw_bale_bisnis_date_state_status';

-- On itm_db (ASID160448_ZTRANS0P source):
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--   AND tablename = 'ASID160448_ZTRANS0P'
--   AND indexname IN ('idx_ztrans0p_trprod_trtrty', 'idx_ztrans0p_merchant');

-- On itm_db (ASID160448_ZRSPCD0P source):
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--   AND tablename = 'ASID160448_ZRSPCD0P'
--   AND indexname = 'idx_zrspcd0p_rsrspc';

-- On itm_db:
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--   AND tablename = 'ASID160448_ZTRANS0P'
--   AND indexname = 'idx_itm_ztrans0p_trtrty_trpccd';

-- On dbs_db:
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--   AND tablename = 'response_code_dictionary'
--   AND indexname = 'idx_rcd_lookup';

-- ── 7.2 Test: raw_bale timeseries (on bale_db) ──────────────
-- Expected: Index Only Scan using idx_raw_bale_active_cat_date
--           Heap Fetches: 0

-- EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
-- SELECT date_trunc('minute', th.transaction_date - interval '7 hour') AS time,
--        COUNT(th.transaction_id) AS total_transaksi
-- FROM raw_bale th
-- WHERE th.transaction_state IN ('1','9','8')
--   AND th.transaction_category = ANY(ARRAY['QR_MPM','TRANSFER_ON_US'])
--   AND th.transaction_date >= ('2026-04-24 00:00:00'::timestamp + interval '7 hour')
--   AND th.transaction_date <= ('2026-04-24 23:59:59'::timestamp + interval '7 hour')
-- GROUP BY 1 ORDER BY 1;

-- ── 7.3 Test: raw_bale_bisnis timeseries (on bale_bisnis_db) ─
-- Expected: Index Scan using idx_raw_bale_bisnis_date_state_status
--           Filter should not show state/status as post-filter

-- EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
-- SELECT th.transaction_date, th.transaction_id, th.result_code
-- FROM raw_bale_bisnis th
-- WHERE th.transaction_state  IN ('0','1','2','3','4')
--   AND th.transaction_status IN ('0','1','2','3','4')
--   AND th.transaction_date >= ('2026-04-24 00:00:00'::timestamp + interval '7 hour')
--   AND th.transaction_date <= ('2026-04-24 23:59:59'::timestamp + interval '7 hour');

-- ── 7.4 Test: EDC Agent scan (on itm_db) ────────────────────
-- Expected: Index Scan using idx_ztrans0p_trprod_trtrty
--           Filters TRTRTY/TRPROD applied at index level

-- EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
-- SELECT "TRXMDT", "TRXMTM", "TRRSPC", "TRSTAN"
-- FROM public."ASID160448_ZTRANS0P"
-- WHERE "TRPROD" = 'POS'
--   AND "TRTRTY" NOT IN ('21','6A','6B','C1','C2');

-- ── 7.5 Test: EDC Merchant partial index (on itm_db) ────────
-- Expected: Index Only Scan using idx_ztrans0p_merchant
--           No heap fetch for TRXMDT/TRXMTM/TRRSPC/TRSTAN

-- EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
-- SELECT "TRXMDT", "TRXMTM", "TRRSPC", "TRSTAN"
-- FROM public."ASID160448_ZTRANS0P"
-- WHERE "TRPROD" = 'POS'
--   AND "TRTRTY" = '21'
--   AND "TRCAID" = '200719398140682';

-- ── 7.6 Test: ZRSPCD0P JOIN lookup (on itm_db) ──────────────
-- Expected: Index Only Scan using idx_zrspcd0p_rsrspc
--           RSSHTD served from index INCLUDE, Heap Fetches: 0

-- EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
-- SELECT "RSRSPC", "RSSHTD"
-- FROM public."ASID160448_ZRSPCD0P"
-- WHERE "RSRSPC" = '00';

-- ── 7.7 Test: ITM source scan (on itm_db) ───────────────────
-- Expected: Index Only Scan using idx_itm_ztrans0p_trtrty_trpccd
--           TRTDAT/TRTTIM/TRRSPC served from INCLUDE, Heap Fetches: 0

-- EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
-- SELECT "TRTDAT", "TRTTIM", "TRRSPC"
-- FROM public."ASID160448_ZTRANS0P"
-- WHERE "TRTRTY" = '21'
--   AND "TRPCCD" = 59;

-- ── 7.8 FDW side verification (run from dbs_db or bale_db) ──
-- Look for "Remote SQL" in EXPLAIN output. The predicates
-- TRPROD='POS', TRTRTY NOT IN/IN, TRCAID IN should appear
-- inside Remote SQL to confirm pushdown to physical db.
-- If predicates are missing from Remote SQL, the physical
-- index still helps but FDW fetches more rows than necessary.

-- Example (from dbs_db with EDC FDW):
-- EXPLAIN (VERBOSE)
-- SELECT "TRXMDT", "TRXMTM", "TRRSPC", "TRSTAN"
-- FROM public."itm_db_ASID160448_ZTRANS0P"
-- WHERE "TRPROD" = 'POS'
--   AND "TRTRTY" NOT IN ('21','6A','6B','C1','C2');

-- ── 7.9 Pass / Fail criteria ─────────────────────────────────
-- PASS:
--   - Plan shows Index Scan or Index Only Scan on new index
--   - Heap Fetches: 0 for INCLUDE-covered queries
--   - Execution time decreases vs. Seq Scan baseline
--   - Remote SQL contains pushed-down predicates (FDW panels)
-- FAIL / INVESTIGATE:
--   - Plan still shows Seq Scan → run SET enable_seqscan=off
--     and re-EXPLAIN to force index; check if cost difference
--     is large enough to warrant a table bloat or stats issue
--   - Heap Fetches > 0 → vacuum/freeze needed or INCLUDE
--     columns not fully covering the query projection
--   - Remote SQL missing predicate → FDW may need
--     `fetch_size` tuning or use of immutable cast functions
