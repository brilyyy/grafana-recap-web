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
  v_jenis_transaksi VARCHAR(1024);
  v_rc VARCHAR(255);
  v_rc_description TEXT;
  v_total_transaksi INT;
  v_total_nominal DECIMAL(20, 2);
  v_status_transaksi VARCHAR(64);
  v_error_type VARCHAR(255);
  v_normalized_rc VARCHAR(255);
  v_normalized_rc_desc VARCHAR(500);
  v_normalized_status VARCHAR(255);
  v_is_rc_empty BOOLEAN;
  v_is_success BOOLEAN;
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
    app_name, id_app_identifier, processing_date, start_time, status, recap_kind, catalog_entry_id
  ) VALUES (
    v_app_name, v_app_id, v_processing_date, NOW(), 'running', 'cms_corp_daily', 'cms_corp_daily'
  )
  RETURNING id INTO v_log_id;

  BEGIN
    DELETE FROM recap_cms_corp_daily
    WHERE id_app_identifier = v_app_id AND tanggal_transaksi = v_processing_date;

    FOR rec IN
      SELECT
        date(a."ACTN_DT") AS tanggal_transaksi,
        COALESCE(NULLIF(BTRIM(a."ACTN_BY_CUST_ID"::text), ''), '(unknown)') AS corp_id,
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
        COALESCE(NULLIF(BTRIM(a."ACTN_BY_CUST_ID"::text), ''), '(unknown)'),
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
      v_jenis_transaksi := rec.jenis_transaksi;
      v_rc := rec.rc;
      v_rc_description := rec.rc_description;
      v_total_transaksi := rec.total_transaksi;
      v_total_nominal := rec.total_nominal;
      v_status_transaksi := rec.status_transaksi;

      v_normalized_rc := NULLIF(TRIM(COALESCE(v_rc, '')), '');
      v_normalized_rc := NULLIF(v_normalized_rc, '-');
      v_is_rc_empty := (v_normalized_rc IS NULL OR v_normalized_rc = '' OR v_normalized_rc = '-');
      v_normalized_rc_desc := LOWER(TRIM(COALESCE(v_rc_description, '')));
      v_normalized_status := LOWER(TRIM(COALESCE(v_status_transaksi, '')));
      v_is_success := (
        v_normalized_rc_desc IN ('sukses', 'success', 'berhasil') OR
        v_normalized_status IN ('sukses', 'success', 'berhasil')
      );
      IF v_is_rc_empty AND v_is_success THEN
        v_normalized_rc := '00';
        v_is_rc_empty := FALSE;
      END IF;
      v_error_type := NULL;
      IF NOT v_is_rc_empty AND v_jenis_transaksi IS NOT NULL THEN
        SELECT error_type INTO v_error_type
        FROM response_code_dictionary
        WHERE id_app_identifier = v_app_id
          AND jenis_transaksi = v_jenis_transaksi
          AND rc = v_normalized_rc
        LIMIT 1;
        IF v_error_type IS NULL THEN
          INSERT INTO unmapped_rc (id_app_identifier, jenis_transaksi, rc, rc_description, status_transaksi, error_type)
          VALUES (v_app_id, v_jenis_transaksi, v_normalized_rc, v_rc_description, v_status_transaksi, NULL)
          ON CONFLICT (id_app_identifier, jenis_transaksi, rc) DO NOTHING;
        END IF;
      END IF;
      IF v_is_rc_empty THEN
        IF v_is_success THEN
          v_normalized_rc := '00';
          v_error_type := 'Sukses';
        ELSE
          v_error_type := NULL;
        END IF;
      END IF;

      INSERT INTO recap_cms_corp_daily (
        id_app_identifier,
        tanggal_transaksi,
        corp_id,
        jenis_transaksi,
        rc,
        rc_description,
        total_transaksi,
        total_nominal,
        status_transaksi,
        error_type
      ) VALUES (
        v_app_id,
        rec.tanggal_transaksi,
        rec.corp_id,
        v_jenis_transaksi,
        v_normalized_rc,
        v_rc_description,
        v_total_transaksi,
        v_total_nominal,
        v_status_transaksi,
        v_error_type::error_type_enum
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
