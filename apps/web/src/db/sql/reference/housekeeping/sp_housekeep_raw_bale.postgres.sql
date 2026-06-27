-- Housekeeping procedure for raw_bale table (PostgreSQL)
-- Deletes rows older than p_retention_days from the current date.
-- Run in bale_db (or platform_db if raw_bale is accessed via FDW).
CREATE OR REPLACE FUNCTION public.sp_housekeep_raw_bale(p_retention_days INTEGER)
RETURNS void AS $$
DECLARE
  v_cutoff_date DATE;
  v_deleted_count BIGINT;
BEGIN
  v_cutoff_date := CURRENT_DATE - p_retention_days;
  DELETE FROM raw_bale WHERE transaction_date < v_cutoff_date::timestamp;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'sp_housekeep_raw_bale: deleted % rows older than % (retention % days)', v_deleted_count, v_cutoff_date, p_retention_days;
END;
$$ LANGUAGE plpgsql;
