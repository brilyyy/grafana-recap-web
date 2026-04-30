CREATE OR REPLACE FUNCTION public.sp_recap_cms_corp_daily(p_processing_date DATE DEFAULT NULL)
RETURNS void AS $$
DECLARE
  v_app_id INT;
  v_app_name VARCHAR(255) := 'CMS';
  v_start_timestamp TIMESTAMP;
  v_end_timestamp TIMESTAMP;
  v_processing_date DATE;
  v_log_id INT;
  v_error_msg TEXT;
  v_records_processed INT := 0;
  v_records_inserted INT := 0;
  rec RECORD;
BEGIN
  IF p_processing_date IS NULL THEN
    v_processing_date := CURRENT_DATE - INTERVAL '1 day';
  ELSE
    v_processing_date := p_processing_date;
  END IF;
  v_start_timestamp := v_processing_date::timestamp;
  v_end_timestamp := (v_processing_date + INTERVAL '1 day' - INTERVAL '1 second')::timestamp;

  SELECT id INTO v_app_id FROM app_identifier WHERE app_name = v_app_name LIMIT 1;
  IF v_app_id IS NULL THEN
    RAISE EXCEPTION 'Application CMS not found in app_identifier table';
  END IF;

  INSERT INTO app_processing_log (
    app_name, id_app_identifier, processing_date, start_time, status, recap_kind
  ) VALUES (
    v_app_name, v_app_id, v_processing_date, NOW(), 'running', 'cms_corp_daily'
  )
  RETURNING id INTO v_log_id;

  BEGIN
    DELETE FROM recap_cms_corp_daily
    WHERE id_app_identifier = v_app_id AND tanggal_transaksi = v_processing_date;

    FOR rec IN
      SELECT
        date(a."ACTN_DT") AS tanggal_transaksi,
        COALESCE(NULLIF(BTRIM(a."CORP_ID"::text), ''), '(unknown)') AS corp_id,
        COALESCE(NULLIF(BTRIM(COALESCE(a."SRVC_NM"::text, '')), ''), '(tidak ada jenis transaksi)') AS jenis_transaksi,
        COALESCE(a."ERR_MAP_CD"::text, '') AS rc,
        COALESCE(a."ERR_MAP_NM"::text, '') AS rc_description,
        COUNT(DISTINCT a."ID")::INT AS total_transaksi,
        COALESCE(SUM(a."AMT"), 0)::DECIMAL(20, 2) AS total_nominal,
        CASE
          WHEN a."IS_ERR" = 'N' THEN 'Sukses'
          WHEN a."IS_ERR" = 'Y' THEN 'Gagal'
          ELSE 'Status Tidak Dikenal'
        END AS status_transaksi
      FROM "cms_db_GCM_AGCM_LOG_ACTV" a
      WHERE a."ACTN_DT" >= v_start_timestamp
        AND a."ACTN_DT" <= v_end_timestamp
      GROUP BY
        date(a."ACTN_DT"),
        COALESCE(NULLIF(BTRIM(a."CORP_ID"::text), ''), '(unknown)'),
        COALESCE(NULLIF(BTRIM(COALESCE(a."SRVC_NM"::text, '')), ''), '(tidak ada jenis transaksi)'),
        COALESCE(a."ERR_MAP_CD"::text, ''),
        COALESCE(a."ERR_MAP_NM"::text, ''),
        CASE
          WHEN a."IS_ERR" = 'N' THEN 'Sukses'
          WHEN a."IS_ERR" = 'Y' THEN 'Gagal'
          ELSE 'Status Tidak Dikenal'
        END
    LOOP
      v_records_processed := v_records_processed + 1;
      INSERT INTO recap_cms_corp_daily (
        id_app_identifier,
        tanggal_transaksi,
        corp_id,
        jenis_transaksi,
        rc,
        rc_description,
        total_transaksi,
        total_nominal,
        status_transaksi
      ) VALUES (
        v_app_id,
        rec.tanggal_transaksi,
        rec.corp_id,
        rec.jenis_transaksi,
        rec.rc,
        rec.rc_description,
        rec.total_transaksi,
        rec.total_nominal,
        rec.status_transaksi
      );
      v_records_inserted := v_records_inserted + 1;
    END LOOP;

    UPDATE app_processing_log
    SET status = 'success', end_time = NOW(), records_processed = v_records_processed, records_inserted = v_records_inserted
    WHERE id = v_log_id;

  EXCEPTION WHEN OTHERS THEN
    v_error_msg := SQLERRM;
    UPDATE app_processing_log SET status = 'failed', end_time = NOW(), error_message = v_error_msg WHERE id = v_log_id;
    RAISE;
  END;
END;
$$ LANGUAGE plpgsql;
