
-- Error Type Lookup
CREATE INDEX idx_rcd_lookup
ON response_code_dictionary (rc, jenis_transaksi, id_app_identifier)
INCLUDE (error_type);

-- Primary Composite Index
CREATE INDEX idx_raw_bale_date_state_cat
ON raw_bale (transaction_date, transaction_state, transaction_category);

-- Heap Fetch
CREATE INDEX idx_raw_bale_covering ON raw_bale (transaction_date, transaction_state, transaction_category) INCLUDE (transaction_id, transaction_amount, result_code);

-- Join Index with RC Dictionary
CREATE INDEX idx_raw_bale_rc_cat ON raw_bale (result_code, transaction_category) WHERE result_code IS NOT NULL;

-- Primary Hot Path (Category Equality + Date Range, State Predicate)
CREATE INDEX idx_raw_bale_active_cat_date
ON raw_bale (transaction_category, transaction_date)
INCLUDE (transaction_id, transaction_amount, result_code)
WHERE transaction_state IN ('1','9','8');

-- CTE Top Error Detail Secondary Lookup
CREATE INDEX idx_raw_bale_rc_cat_date
ON raw_bale (result_code, result_code_desc, transaction_category, transaction_date)
INCLUDE (esb_ref_no, transaction_id)
WHERE result_code IS NOT NULL
  AND transaction_state IN ('1','9','8');

-- Optional Cleanup (superseded by indexes above; uncomment after verifying plans with EXPLAIN (ANALYZE, BUFFERS))
-- DROP INDEX IF EXISTS idx_raw_bale_date_state_cat;
-- DROP INDEX IF EXISTS idx_raw_bale_rc_cat;
