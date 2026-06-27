-- Housekeeping procedure for openaccount_syslog table / OLOB (PostgreSQL)
-- Deletes rows older than p_retention_days from the current date.
CREATE OR REPLACE FUNCTION public.sp_housekeep_raw_olob(p_retention_days INTEGER)
RETURNS void AS $$
DECLARE
  v_cutoff_date DATE;
  v_deleted_count BIGINT;
BEGIN
  v_cutoff_date := CURRENT_DATE - p_retention_days;
  DELETE FROM openaccount_syslog WHERE log_dt < v_cutoff_date::timestamp;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'sp_housekeep_raw_olob: deleted % rows older than % (retention % days)', v_deleted_count, v_cutoff_date, p_retention_days;
END;
$$ LANGUAGE plpgsql;
