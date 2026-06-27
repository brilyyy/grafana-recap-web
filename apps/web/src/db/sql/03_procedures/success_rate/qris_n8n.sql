/* @meta
id: sr:qris_n8n
recap_kind: success_rate_daily
title: QRIS N8N — success rate (daily)
output_table: app_success_rate
function_name: sp_process_qris_n8n_daily
scope_type: per_app
app_key: qris_n8n
raw_sql_repo_path: src/db/sql/reference/success_rate/qris_n8n.raw.sql
description: H-1 recap of transaction success metrics into app_success_rate for QRIS N8N.
brief_process_summary: Reads raw_qris_n8n, aggregates transactions, joins response_code_dictionary for rc_description and error_type, then inserts into app_success_rate.
brief_query: FROM raw_qris_n8n aggregate; LEFT JOIN response_code_dictionary; INSERT app_success_rate.
@endmeta */

CREATE OR REPLACE FUNCTION public.sp_process_qris_n8n_daily(p_processing_date DATE DEFAULT NULL)
RETURNS void AS $$
DECLARE
  v_app_id INT;
  v_app_name VARCHAR(255) := 'QRIS N8N';
  v_processing_date DATE;
  v_start_timestamp TIMESTAMP;
  v_end_timestamp TIMESTAMP;
  v_log_id INT;
  v_error_msg TEXT;

  v_records_processed INT := 0;
  v_records_inserted INT := 0;
BEGIN
  -- 1. processing date
  IF p_processing_date IS NULL THEN
    v_processing_date := CURRENT_DATE - INTERVAL '1 day';
  ELSE
    v_processing_date := p_processing_date;
  END IF;

  v_start_timestamp := v_processing_date::timestamp;
  v_end_timestamp := v_processing_date + INTERVAL '1 day';

  -- 2. resolve app_id
  SELECT id INTO v_app_id
  FROM app_identifier
  WHERE app_name = v_app_name
  LIMIT 1;

  IF v_app_id IS NULL THEN
    RAISE EXCEPTION 'Application QRIS N8N not found in app_identifier table';
  END IF;

  -- 3. start log
  INSERT INTO app_processing_log (
    app_name,
    id_app_identifier,
    processing_date,
    start_time,
    status,
    catalog_entry_id
  )
  VALUES (
    v_app_name,
    v_app_id,
    v_processing_date,
    NOW(),
    'running',
    'sr:qris_n8n'
  )
  RETURNING id INTO v_log_id;

  BEGIN
    -- 4. delete existing
    DELETE FROM app_success_rate
    WHERE id_app_identifier = v_app_id
      AND tanggal_transaksi = v_processing_date;

    -- 5. bulk insert
    INSERT INTO app_success_rate (
      id_app_identifier,
      tanggal_transaksi,
      bulan,
      tahun,
      jenis_transaksi,
      rc,
      rc_description,
      total_transaksi,
      total_nominal,
      total_biaya_admin,
      status_transaksi,
      error_type
    )
    SELECT
      v_app_id,
      agg.dt,
      EXTRACT(MONTH FROM agg.dt)::VARCHAR,
      EXTRACT(YEAR FROM agg.dt),

      -- mapping
      agg.code_description,

      COALESCE(agg.response_code, ''),

      COALESCE(rcd.rc_description, ''),

      agg.total_trx,
      agg.total_nominal,

      NULL,

      -- ✅ status_transaksi mapping
      CASE
        WHEN agg.response_code = '00' THEN 'Success'
        ELSE 'Failed'
      END,

      -- ✅ error_type mapping from dictionary
      rcd.error_type

    FROM (
      SELECT
        DATE(t.trx_timestamp) AS dt,
        t.code_description,
        t.response_code,
        COUNT(DISTINCT t.elastic_id) AS total_trx,
        SUM(t.trx_amount) AS total_nominal
      FROM raw_qris_n8n t
      WHERE t.trx_timestamp >= v_start_timestamp
        AND t.trx_timestamp < v_end_timestamp
      GROUP BY
        DATE(t.trx_timestamp),
        t.code_description,
        t.response_code
    ) agg

    LEFT JOIN response_code_dictionary rcd
      ON rcd.id_app_identifier = v_app_id
     AND rcd.rc = agg.response_code
     AND rcd.jenis_transaksi = agg.code_description;

    -- 6. row count
    GET DIAGNOSTICS v_records_inserted = ROW_COUNT;
    v_records_processed := v_records_inserted;

    -- 7. success log
    UPDATE app_processing_log
    SET
      status = 'success',
      end_time = NOW(),
      records_processed = v_records_processed,
      records_inserted = v_records_inserted
    WHERE id = v_log_id;

  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_msg = MESSAGE_TEXT;

    UPDATE app_processing_log
    SET
      status = 'failed',
      end_time = NOW(),
      error_message = v_error_msg
    WHERE id = v_log_id;

    RAISE;
  END;
END;
$$ LANGUAGE plpgsql;
