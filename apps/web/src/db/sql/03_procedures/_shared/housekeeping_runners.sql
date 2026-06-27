-- Shared housekeeping runner functions (PostgreSQL). Idempotent via CREATE OR REPLACE.
-- Resolve the actual FDW foreign-table name so DELETE targets the prefixed table even
-- when raw_table_housekeeping.table_name still holds the old short (logical) name.

CREATE OR REPLACE FUNCTION public.housekeeping_platform_relation(p_db_name TEXT, p_table_name TEXT)
RETURNS TEXT AS $$
DECLARE
  v_raw    TEXT;
  v_suffix TEXT;
BEGIN
  -- If already prefixed with db_name_, use as-is.
  IF p_table_name LIKE p_db_name || '_%' THEN
    RETURN p_table_name;
  END IF;
  v_raw := p_db_name || '_' || p_table_name;
  IF char_length(v_raw) <= 63 THEN
    RETURN v_raw;
  END IF;
  -- Replicate JS: first 55 chars + '_' + first 7 hex chars of MD5(db:table)
  v_suffix := substring(md5(p_db_name || ':' || p_table_name) FROM 1 FOR 7);
  RETURN substring(v_raw FROM 1 FOR 55) || '_' || v_suffix;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.sp_run_raw_housekeeping(p_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
  v_db_name        TEXT;
  v_table_name     TEXT;
  v_rel_name       TEXT;
  v_date_column    TEXT;
  v_date_col_type  TEXT;
  v_retention_days INTEGER;
  v_sql            TEXT;
  v_deleted        INTEGER;
BEGIN
  SELECT db_name, table_name, date_column, date_column_type, retention_days
    INTO v_db_name, v_table_name, v_date_column, v_date_col_type, v_retention_days
    FROM raw_table_housekeeping
   WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Housekeeping config id=% not found', p_id;
  END IF;

  IF v_retention_days IS NULL THEN
    RAISE EXCEPTION 'retention_days not set for table %', v_table_name;
  END IF;

  IF v_date_column IS NULL THEN
    RAISE EXCEPTION 'date_column not set for table % (reference table – housekeeping not applicable)', v_table_name;
  END IF;

  -- Resolve the actual FDW foreign-table name (prefixed) so DELETE bypasses any view.
  v_rel_name := public.housekeeping_platform_relation(v_db_name, v_table_name);

  IF v_date_col_type = 'int_1yymmdd' THEN
    -- TRXMDT integer format: 1YYMMDD (e.g. 1250311 = 2025-03-11)
    v_sql := format(
      'DELETE FROM %I WHERE %I < (1000000'
      ' + (EXTRACT(YEAR  FROM (CURRENT_DATE - (''%s days'')::INTERVAL))::int %% 100) * 10000'
      ' + (EXTRACT(MONTH FROM (CURRENT_DATE - (''%s days'')::INTERVAL))::int) * 100'
      ' + (EXTRACT(DAY   FROM (CURRENT_DATE - (''%s days'')::INTERVAL))::int))',
      v_rel_name, v_date_column,
      v_retention_days, v_retention_days, v_retention_days
    );
  ELSE
    -- Standard timestamp / date column
    v_sql := format(
      'DELETE FROM %I WHERE %I < (CURRENT_DATE - (''%s days'')::INTERVAL)',
      v_rel_name, v_date_column, v_retention_days
    );
  END IF;

  EXECUTE v_sql;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.sp_run_all_raw_housekeeping()
RETURNS INTEGER AS $$
DECLARE
  r         RECORD;
  v_n       INTEGER;
  v_total   INTEGER := 0;
BEGIN
  FOR r IN
    SELECT id FROM raw_table_housekeeping
    WHERE date_column IS NOT NULL AND retention_days IS NOT NULL
    ORDER BY id
  LOOP
    BEGIN
      v_n := public.sp_run_raw_housekeeping(r.id);
      v_total := v_total + COALESCE(v_n, 0);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'sp_run_all_raw_housekeeping: id=% failed: %', r.id, SQLERRM;
    END;
  END LOOP;
  RETURN v_total;
END;
$$ LANGUAGE plpgsql;
