CREATE OR REPLACE FUNCTION public.sp_process_bale_daily(p_processing_date DATE DEFAULT NULL)
RETURNS void AS $$
DECLARE
  v_app_id INT;
  v_app_name VARCHAR(255) := 'Bale';
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
    RAISE EXCEPTION 'Application Bale not found in app_identifier table';
  END IF;

  INSERT INTO app_processing_log (app_name, id_app_identifier, processing_date, start_time, status, catalog_entry_id)
  VALUES (v_app_name, v_app_id, v_processing_date, NOW(), 'running', 'sr:bale')
  RETURNING id INTO v_log_id;

  BEGIN
    DELETE FROM app_success_rate WHERE id_app_identifier = v_app_id AND tanggal_transaksi = v_processing_date;

    FOR rec IN
      WITH categories AS (
        SELECT unnest(ARRAY[
          'ACTIVATE_DORMANT','BILLPAYMENT_BANK_LOAN','BILLPAYMENT_BPJS_KESEHATAN','BILLPAYMENT_BPJS_TENAGA_KERJA',
          'BILLPAYMENT_CREDIT_CARD','BILLPAYMENT_CREDIT_CARD_OTHER','BILLPAYMENT_DONATION_ACT',
          'BILLPAYMENT_DONATION_BAZNAS','BILLPAYMENT_DONATION_DOMPET','BILLPAYMENT_ECOM_BUKALAPAK',
          'BILLPAYMENT_ECOM_TOKOPEDIA','BILLPAYMENT_EDUCATION','BILLPAYMENT_INSURANCE',
          'BILLPAYMENT_INTERNET_TV','BILLPAYMENT_MPN','BILLPAYMENT_MULTIBILLER',
          'BILLPAYMENT_MULTIBILLER_LEGAL','BILLPAYMENT_NON_PBB','BILLPAYMENT_OTHER_LOAN','BILLPAYMENT_PBB',
          'BILLPAYMENT_PDAM','BILLPAYMENT_PEGADAIAN','BILLPAYMENT_PGN','BILLPAYMENT_PHONE',
          'BILLPAYMENT_PLN','BILLPAYMENT_TICKET_TRAIN','BILLPAYMENT_TRANSPORTATION','BILLPAYMENT_VA',
          'BILLPAYMENT_VA_MORTGAGE','BILLPAYMENT_VEHICLE_TAX','BUY_MUTUAL_FUND','BUY_SBN',
          'CARDLESS_DEPOSIT','CARDLESS_WITHDRAWAL','EDEPOSITO_PLACEMENT','EDEPOSITO_WITHDRAWAL',
          'FREEZE_PROXY_BIFAST','MONEY_CHANGER','PORTING_PROXY_BIFAST',
          'PURCHASE_EVOUCHER_MTIX','PURCHASE_EVOUCHER_STREAMING','PURCHASE_NFC_EMONEY',
          'PURCHASE_NFC_FLAZZ','PURCHASE_NFC_TAPCASH','PURCHASE_PHONE','PURCHASE_PLN_PREPAID',
          'PURCHASE_TOPUP_DANA','PURCHASE_TOPUP_GOPAY','PURCHASE_TOPUP_ISAKU','PURCHASE_TOPUP_LINKAJA',
          'PURCHASE_TOPUP_OVO','PURCHASE_TOPUP_POSPAY','PURCHASE_TOPUP_SHOPEEPAY','QR_CROSS_BORDER',
          'QR_MPM','REGISTRATION_PROXY_BIFAST','SELL_MUTUAL_FUND','SWITCH_FROM_MUTUAL_FUND',
          'SWITCH_TO_MUTUAL_FUND','TRANSFER_ALL','TRANSFER_BIFAST','TRANSFER_FOREX_OA',
          'TRANSFER_FOREX_ON_US','TRANSFER_OA','TRANSFER_OFF_US','TRANSFER_ON_US','TRANSFER_RTGS',
          'TRANSFER_SKN','TRANSFER_SPLIT_BILL','TRANSFER_SWIFT','UNFREEZE_PROXY_BIFAST',
          'UNREGISTRATION_PROXY_BIFAST','UPDATE_PROXY_BIFAST'
        ]) AS category
      )
      SELECT
        to_char(rb.transaction_date,'YYYY-MM-DD') AS "Tanggal Transaksi",
        rb.transaction_category AS "Jenis Transaksi",
        rb.result_code AS "RC",
        rb.result_code_desc AS "RC Description",
        count(DISTINCT rb.id) AS "total transaksi",
        SUM(rb.transaction_amount) AS "Total Nominal",
        SUM(rb.transaction_fee) AS "Total Biaya Admin",
        CASE
          WHEN rb.transaction_status = 0 THEN 'Success'
          WHEN rb.transaction_status = 1 THEN 'Failed'
          WHEN rb.transaction_status = 2 THEN 'Pending'
          WHEN rb.transaction_status = 9 THEN 'ACK'
          WHEN rb.transaction_status = 8 THEN 'REVERSAL'
          ELSE 'Status Tidak Dikenal'
        END AS "Status Transaksi"
      FROM raw_bale rb
      JOIN categories c ON rb.transaction_category = c.category
      WHERE rb.transaction_state IN ('1','9','8')
        AND rb.transaction_date BETWEEN v_start_timestamp AND v_end_timestamp
      GROUP BY "Tanggal Transaksi",rb.transaction_category,rb.result_code,rb.result_code_desc,rb.transaction_status
      ORDER BY "Tanggal Transaksi" DESC
    LOOP
      v_records_processed := v_records_processed + 1;
      v_tanggal_transaksi := rec."Tanggal Transaksi"::date;
      v_jenis_transaksi   := rec."Jenis Transaksi";
      v_rc                := rec."RC";
      v_rc_description    := rec."RC Description";
      v_total_transaksi   := rec."total transaksi";
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
          VALUES (v_app_id, v_jenis_transaksi, COALESCE(v_normalized_rc, ''), COALESCE(v_rc_description, ''), v_status_transaksi, NULL)
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
