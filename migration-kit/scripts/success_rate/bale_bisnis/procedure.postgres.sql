CREATE OR REPLACE FUNCTION public.sp_process_bale_bisnis_daily(p_processing_date DATE DEFAULT NULL)
RETURNS void AS $$
DECLARE
  v_app_id INT;
  v_app_name VARCHAR(255) := 'Bale Bisnis';
  v_start_timestamp TIMESTAMP;
  v_end_timestamp TIMESTAMP;
  v_processing_date DATE;
  v_log_id INT;
  v_error_msg TEXT;
  v_records_processed INT := 0;
  v_records_inserted INT := 0;
  rec RECORD;
  v_tanggal_transaksi DATE;
  v_jenis_transaksi VARCHAR(255);
  v_rc VARCHAR(50);
  v_rc_description VARCHAR(500);
  v_total_transaksi INT;
  v_total_nominal DECIMAL(20,2);
  v_total_biaya_admin DECIMAL(20,2);
  v_status_transaksi VARCHAR(255);
  v_bulan VARCHAR(20);
  v_tahun INT;
  v_error_type VARCHAR(255);
  v_normalized_rc VARCHAR(50);
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
    RAISE EXCEPTION 'Application Bale Bisnis not found in app_identifier table';
  END IF;

  INSERT INTO app_processing_log (app_name, id_app_identifier, processing_date, start_time, status)
  VALUES (v_app_name, v_app_id, v_processing_date, NOW(), 'running')
  RETURNING id INTO v_log_id;

  BEGIN
    DELETE FROM app_success_rate WHERE id_app_identifier = v_app_id AND tanggal_transaksi = v_processing_date;

    FOR rec IN
      WITH days AS (
        SELECT v_processing_date::timestamp AS transaction_date
      ),
      features AS (
        SELECT DISTINCT rbb.transaction_category
        FROM raw_bale_bisnis rbb
        WHERE rbb.transaction_date >= v_start_timestamp
          AND rbb.transaction_date <  v_end_timestamp + INTERVAL '1 second'
      ),
      statuses AS (
        SELECT * FROM (VALUES
          (0, 'SUCCESS'),
          (1, 'FAILED'),
          (2, 'SUSPECT'),
          (3, 'WAITING'),
          (4, 'REJECTED')
        ) AS s(status_code, transaction_status)
      ),
      states AS (
        SELECT * FROM (VALUES
          (0, 'INQUIRY'),
          (1, 'EXECUTE'),
          (2, 'EXECUTE_SCHEDULER'),
          (3, 'INQUIRY_PARTIAL'),
          (4, 'SCHEDULED')
        ) AS st(state_code, transaction_state)
      ),
      agg AS (
        SELECT
            rbb.transaction_date::date AS transaction_date,
            rbb.transaction_category,
            rbb.transaction_status,
            rbb.transaction_state,
            rbb.result_code,
            rbb.result_code_desc,
            COUNT(*)                               AS transaction_count,
            COALESCE(SUM(rbb.transaction_amount),0) AS transaction_amount,
            COALESCE(SUM(rbb.admin_fee),0)          AS total_admin_fee
        FROM raw_bale_bisnis rbb
        WHERE rbb.transaction_date >= v_start_timestamp
          AND rbb.transaction_date <  v_end_timestamp + INTERVAL '1 second'
          AND rbb.transaction_count != 0
        GROUP BY 1,2,3,4,5,6
      )
      SELECT
          d.transaction_date::date               AS "Tanggal Transaksi",
          f.transaction_category                 AS "Jenis Transaksi",
          s.transaction_status                   AS "Status Transaksi",
          COALESCE(a.transaction_count, 0)::INT  AS "Total Transaksi",
          COALESCE(a.transaction_amount, 0)      AS "Total Nominal",
          COALESCE(a.total_admin_fee, 0)         AS "Total Biaya Admin",
          COALESCE(a.result_code, '-')           AS "RC",
          COALESCE(a.result_code_desc, '-')      AS "RC Description"
      FROM days d
      CROSS JOIN features f
      CROSS JOIN statuses s
      CROSS JOIN states st
      LEFT JOIN agg a
        ON a.transaction_date    = d.transaction_date::date
       AND a.transaction_category = f.transaction_category
       AND a.transaction_status   = s.status_code
       AND a.transaction_state    = st.state_code
      ORDER BY
          d.transaction_date,
          f.transaction_category,
          s.transaction_status,
          st.transaction_state,
          a.result_code NULLS LAST
    LOOP
      v_records_processed := v_records_processed + 1;
      v_tanggal_transaksi := rec."Tanggal Transaksi";
      v_jenis_transaksi   := rec."Jenis Transaksi";
      v_rc                := rec."RC";
      v_rc_description    := rec."RC Description";
      v_total_transaksi   := rec."Total Transaksi";
      v_total_nominal     := rec."Total Nominal";
      v_total_biaya_admin := rec."Total Biaya Admin";
      v_status_transaksi  := rec."Status Transaksi";
      v_bulan := EXTRACT(MONTH FROM v_tanggal_transaksi)::VARCHAR;
      v_tahun := EXTRACT(YEAR  FROM v_tanggal_transaksi);
      v_normalized_rc := NULLIF(TRIM(COALESCE(v_rc, '')), '');
      v_normalized_rc := NULLIF(v_normalized_rc, '-');
      v_is_rc_empty := (v_normalized_rc IS NULL OR v_normalized_rc = '' OR v_normalized_rc = '-');
      v_normalized_rc_desc := LOWER(TRIM(COALESCE(v_rc_description, '')));
      v_normalized_status  := LOWER(TRIM(COALESCE(v_status_transaksi, '')));
      v_is_success := (
        v_normalized_rc_desc IN ('sukses','success','berhasil') OR
        v_normalized_status  IN ('sukses','success','berhasil')
      );
      IF v_is_rc_empty AND v_is_success THEN
        v_normalized_rc := '00'; v_is_rc_empty := FALSE;
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
        IF v_is_success THEN v_normalized_rc := '00'; v_error_type := 'Sukses';
        ELSE v_error_type := NULL; END IF;
      END IF;
      INSERT INTO app_success_rate (
        id_app_identifier, tanggal_transaksi, bulan, tahun, jenis_transaksi, rc, rc_description,
        total_transaksi, total_nominal, total_biaya_admin, status_transaksi, error_type
      ) VALUES (
        v_app_id, v_tanggal_transaksi, v_bulan, v_tahun, v_jenis_transaksi, v_normalized_rc, v_rc_description,
        v_total_transaksi, v_total_nominal, v_total_biaya_admin, v_status_transaksi, v_error_type::error_type_enum
      );
      v_records_inserted := v_records_inserted + 1;
    END LOOP;

    UPDATE app_processing_log
    SET status = 'success', end_time = NOW(), records_processed = v_records_processed, records_inserted = v_records_inserted
    WHERE id = v_log_id;

  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_msg = MESSAGE_TEXT;
    UPDATE app_processing_log SET status = 'failed', end_time = NOW(), error_message = v_error_msg WHERE id = v_log_id;
    RAISE;
  END;
END;
$$ LANGUAGE plpgsql
