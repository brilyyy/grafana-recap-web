-- EDC Merchant: reads from ASID160448_ZTRANS0P + ASID160448_ZRSPCD0P (via FDW from itm_db)
-- Filter: TRTRTY = '21', TRPROD = 'POS'
CREATE OR REPLACE FUNCTION public.sp_process_edc_merchant_daily(p_processing_date DATE DEFAULT NULL)
RETURNS void AS $$
DECLARE
  v_app_id INT;
  v_app_name VARCHAR(255) := 'EDC Merchant';
  v_processing_date DATE;
  v_log_id INT;
  v_error_msg TEXT;
  v_records_processed INT := 0;
  v_records_inserted INT := 0;
  rec RECORD;
  v_tanggal_transaksi DATE;
  v_jenis_transaksi VARCHAR(255) := 'POS';
  v_rc VARCHAR(50);
  v_rc_description VARCHAR(500);
  v_total_transaksi INT;
  v_total_nominal DECIMAL(20,2);
  v_bulan VARCHAR(20);
  v_tahun INT;
  v_error_type VARCHAR(255);
  v_normalized_rc VARCHAR(50);
  v_normalized_rc_desc VARCHAR(500);
  v_is_rc_empty BOOLEAN;
  v_is_success BOOLEAN;
  v_trxmdt_int INT;
BEGIN
  IF p_processing_date IS NULL THEN
    v_processing_date := CURRENT_DATE - INTERVAL '1 day';
  ELSE
    v_processing_date := p_processing_date;
  END IF;

  SELECT id INTO v_app_id FROM app_identifier WHERE app_name = v_app_name LIMIT 1;
  IF v_app_id IS NULL THEN
    RAISE EXCEPTION 'Application EDC Merchant not found in app_identifier table';
  END IF;

  v_trxmdt_int := 1000000 + (EXTRACT(YEAR FROM v_processing_date)::int % 100) * 10000
    + EXTRACT(MONTH FROM v_processing_date)::int * 100
    + EXTRACT(DAY FROM v_processing_date)::int;

  INSERT INTO app_processing_log (app_name, id_app_identifier, processing_date, start_time, status, catalog_entry_id)
  VALUES (v_app_name, v_app_id, v_processing_date, NOW(), 'running', 'sr:edc_merchant')
  RETURNING id INTO v_log_id;

  BEGIN
    DELETE FROM app_success_rate WHERE id_app_identifier = v_app_id AND tanggal_transaksi = v_processing_date;

    FOR rec IN
      SELECT
        TO_DATE(SUBSTRING(t."TRXMDT"::text FROM 2), 'YYMMDD')::date AS "Tanggal Transaksi",
        t."TRRSPC" AS "RC",
        r."RSSHTD" AS "RC Description",
        count(t."TRRSPC")::int AS "Total Transaksi",
        COALESCE(SUM(t."TRTRN$"), 0) AS "Total Nominal"
      FROM "ASID160448_ZTRANS0P" t
      JOIN "ASID160448_ZRSPCD0P" r ON t."TRRSPC" = r."RSRSPC"
      WHERE t."TRTRTY" = '21'
        AND t."TRPROD" = 'POS'
        AND t."TRXMDT" = v_trxmdt_int
      GROUP BY t."TRXMDT", t."TRRSPC", r."RSSHTD"
      ORDER BY count(t."TRRSPC") DESC
    LOOP
      v_records_processed := v_records_processed + 1;
      v_tanggal_transaksi := rec."Tanggal Transaksi";
      v_rc                := rec."RC";
      v_rc_description    := rec."RC Description";
      v_total_transaksi   := rec."Total Transaksi";
      v_total_nominal     := rec."Total Nominal";
      v_bulan := EXTRACT(MONTH FROM v_tanggal_transaksi)::VARCHAR;
      v_tahun := EXTRACT(YEAR FROM v_tanggal_transaksi);
      v_normalized_rc := NULLIF(TRIM(COALESCE(v_rc, '')), '');
      v_normalized_rc := NULLIF(v_normalized_rc, '-');
      v_is_rc_empty := (v_normalized_rc IS NULL OR v_normalized_rc = '' OR v_normalized_rc = '-');
      v_normalized_rc_desc := LOWER(TRIM(COALESCE(v_rc_description, '')));
      v_is_success := (
        v_normalized_rc_desc IN ('sukses','success','berhasil')
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
          VALUES (v_app_id, v_jenis_transaksi, COALESCE(v_normalized_rc, ''), COALESCE(v_rc_description, ''), NULL, NULL)
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
        v_app_id, v_tanggal_transaksi, v_bulan, v_tahun, v_jenis_transaksi, COALESCE(v_normalized_rc, ''), COALESCE(v_rc_description, ''),
        v_total_transaksi, v_total_nominal, 0, NULL, v_error_type::error_type_enum
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
$$ LANGUAGE plpgsql;
