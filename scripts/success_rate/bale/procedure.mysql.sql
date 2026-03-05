CREATE PROCEDURE sp_process_bale_daily(IN p_processing_date DATE)
MODIFIES SQL DATA
SQL SECURITY DEFINER
BEGIN
  DECLARE v_app_id INT;
  DECLARE v_app_name VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'Bale';
  DECLARE v_start_timestamp DATETIME;
  DECLARE v_end_timestamp DATETIME;
  DECLARE v_processing_date DATE;
  DECLARE v_log_id INT;
  DECLARE v_error_msg TEXT;
  DECLARE v_records_processed INT DEFAULT 0;
  DECLARE v_records_inserted  INT DEFAULT 0;
  DECLARE v_done INT DEFAULT 0;
  DECLARE v_tanggal_transaksi DATE;
  DECLARE v_jenis_transaksi VARCHAR(255);
  DECLARE v_rc VARCHAR(50);
  DECLARE v_rc_description VARCHAR(500);
  DECLARE v_total_transaksi INT;
  DECLARE v_total_nominal DECIMAL(20,2);
  DECLARE v_total_biaya_admin DECIMAL(20,2);
  DECLARE v_status_transaksi VARCHAR(255);
  DECLARE v_bulan VARCHAR(20);
  DECLARE v_tahun INT;
  DECLARE v_error_type VARCHAR(255);
  DECLARE v_normalized_rc VARCHAR(50);
  DECLARE v_normalized_rc_desc VARCHAR(500);
  DECLARE v_normalized_status VARCHAR(255);
  DECLARE v_is_rc_empty BOOLEAN;
  DECLARE v_is_success BOOLEAN;

  DECLARE cur_bale_data CURSOR FOR
    WITH categories AS (
      SELECT 'ACTIVATE_DORMANT' COLLATE utf8mb4_unicode_ci AS category UNION ALL
      SELECT 'BILLPAYMENT_BANK_LOAN' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_BPJS_KESEHATAN' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_BPJS_TENAGA_KERJA' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_CREDIT_CARD' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_CREDIT_CARD_OTHER' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_DONATION_ACT' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_DONATION_BAZNAS' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_DONATION_DOMPET' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_ECOM_BUKALAPAK' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_ECOM_TOKOPEDIA' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_EDUCATION' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_INSURANCE' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_INTERNET_TV' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_MPN' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_MULTIBILLER' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_MULTIBILLER_LEGAL' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_NON_PBB' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_OTHER_LOAN' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_PBB' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_PDAM' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_PEGADAIAN' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_PGN' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_PHONE' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_PLN' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_TICKET_TRAIN' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_TRANSPORTATION' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_VA' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_VA_MORTGAGE' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_VEHICLE_TAX' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BUY_MUTUAL_FUND' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BUY_SBN' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'CARDLESS_DEPOSIT' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'CARDLESS_WITHDRAWAL' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'EDEPOSITO_PLACEMENT' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'EDEPOSITO_WITHDRAWAL' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'FREEZE_PROXY_BIFAST' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'MONEY_CHANGER' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'PORTING_PROXY_BIFAST' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'PURCHASE_EVOUCHER_MTIX' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'PURCHASE_EVOUCHER_STREAMING' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'PURCHASE_NFC_EMONEY' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'PURCHASE_NFC_FLAZZ' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'PURCHASE_NFC_TAPCASH' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'PURCHASE_PHONE' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'PURCHASE_PLN_PREPAID' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'PURCHASE_TOPUP_DANA' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'PURCHASE_TOPUP_GOPAY' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'PURCHASE_TOPUP_ISAKU' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'PURCHASE_TOPUP_LINKAJA' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'PURCHASE_TOPUP_OVO' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'PURCHASE_TOPUP_POSPAY' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'PURCHASE_TOPUP_SHOPEEPAY' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'QR_CROSS_BORDER' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'QR_MPM' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'REGISTRATION_PROXY_BIFAST' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'SELL_MUTUAL_FUND' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'SWITCH_FROM_MUTUAL_FUND' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'SWITCH_TO_MUTUAL_FUND' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'TRANSFER_ALL' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'TRANSFER_BIFAST' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'TRANSFER_FOREX_OA' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'TRANSFER_FOREX_ON_US' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'TRANSFER_OA' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'TRANSFER_OFF_US' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'TRANSFER_ON_US' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'TRANSFER_RTGS' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'TRANSFER_SKN' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'TRANSFER_SPLIT_BILL' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'TRANSFER_SWIFT' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'UNFREEZE_PROXY_BIFAST' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'UNREGISTRATION_PROXY_BIFAST' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'UPDATE_PROXY_BIFAST' COLLATE utf8mb4_unicode_ci
    )
    SELECT
      DATE_FORMAT(rb.transaction_date,'%Y-%m-%d') AS `Tanggal Transaksi`,
      rb.transaction_category AS `Jenis Transaksi`,
      rb.result_code AS `RC`,
      rb.result_code_desc AS `RC Description`,
      COUNT(DISTINCT rb.id) AS `total transaksi`,
      SUM(rb.transaction_amount) AS `Total Nominal`,
      SUM(rb.transaction_fee) AS `Total Biaya Admin`,
      CASE
        WHEN rb.transaction_status = 0 THEN 'Success'
        WHEN rb.transaction_status = 1 THEN 'Failed'
        WHEN rb.transaction_status = 2 THEN 'Pending'
        WHEN rb.transaction_status = 9 THEN 'ACK'
        WHEN rb.transaction_status = 8 THEN 'REVERSAL'
        ELSE 'Status Tidak Dikenal'
      END AS `Status Transaksi`
    FROM `bale_db`.`raw_bale` rb
    JOIN categories c ON rb.transaction_category COLLATE utf8mb4_unicode_ci = c.category COLLATE utf8mb4_unicode_ci
    WHERE rb.transaction_state IN ('1','9','8')
      AND rb.transaction_date BETWEEN v_start_timestamp AND v_end_timestamp
    GROUP BY `Tanggal Transaksi`,rb.transaction_category,rb.result_code,rb.result_code_desc,rb.transaction_status
    ORDER BY `Tanggal Transaksi` DESC;

  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = 1;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    BEGIN ROLLBACK; END;
    GET DIAGNOSTICS CONDITION 1 v_error_msg = MESSAGE_TEXT;
    IF v_log_id IS NOT NULL THEN
      BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION BEGIN END;
        UPDATE app_processing_log SET status='failed', end_time=NOW(),
          error_message=CONCAT(COALESCE(error_message,''),' | ',COALESCE(v_error_msg,'UNKNOWN')) WHERE id=v_log_id;
      END;
    END IF;
    RESIGNAL;
  END;

  IF p_processing_date IS NULL THEN SET v_processing_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY);
  ELSE SET v_processing_date = p_processing_date; END IF;

  SET v_start_timestamp = v_processing_date;
  SET v_end_timestamp = DATE_ADD(v_processing_date, INTERVAL 1 DAY) - INTERVAL 1 SECOND;

  SET v_done = 0;
  SELECT id INTO v_app_id FROM app_identifier
  WHERE app_name COLLATE utf8mb4_unicode_ci = v_app_name COLLATE utf8mb4_unicode_ci LIMIT 1;
  SET v_done = 0;
  IF v_app_id IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Application Bale not found in app_identifier table'; END IF;

  INSERT INTO app_processing_log (app_name, id_app_identifier, processing_date, start_time, status)
  VALUES (v_app_name, v_app_id, v_processing_date, NOW(), 'running');
  SET v_log_id = LAST_INSERT_ID();
  IF v_log_id IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Failed to create processing log entry'; END IF;

  START TRANSACTION;
  DELETE FROM app_success_rate WHERE id_app_identifier=v_app_id AND tanggal_transaksi=v_processing_date;

  SET v_done = 0;
  OPEN cur_bale_data;
  read_loop: LOOP
    FETCH cur_bale_data INTO v_tanggal_transaksi,v_jenis_transaksi,v_rc,v_rc_description,
      v_total_transaksi,v_total_nominal,v_total_biaya_admin,v_status_transaksi;
    IF v_done THEN LEAVE read_loop; END IF;
    SET v_records_processed = v_records_processed + 1;
    SET v_bulan = MONTH(v_tanggal_transaksi);
    SET v_tahun = YEAR(v_tanggal_transaksi);
    SET v_normalized_rc = NULLIF(TRIM(COALESCE(v_rc,'')), '');
    SET v_normalized_rc = NULLIF(v_normalized_rc, '-');
    SET v_is_rc_empty = (v_normalized_rc IS NULL OR v_normalized_rc='' OR v_normalized_rc='-');
    SET v_normalized_rc_desc = LOWER(TRIM(COALESCE(v_rc_description,'')));
    SET v_normalized_status  = LOWER(TRIM(COALESCE(v_status_transaksi,'')));
    SET v_is_success = (
      v_normalized_rc_desc IN ('sukses','success','berhasil') OR
      v_normalized_status  IN ('sukses','success','berhasil')
    );
    IF v_is_rc_empty AND v_is_success THEN SET v_normalized_rc='00'; SET v_is_rc_empty=FALSE; END IF;
    SET v_error_type = NULL;
    IF NOT v_is_rc_empty AND v_jenis_transaksi IS NOT NULL THEN
      SET v_done = 0;
      SELECT error_type INTO v_error_type FROM response_code_dictionary
      WHERE id_app_identifier=v_app_id
        AND jenis_transaksi COLLATE utf8mb4_unicode_ci=v_jenis_transaksi COLLATE utf8mb4_unicode_ci
        AND rc COLLATE utf8mb4_unicode_ci=v_normalized_rc COLLATE utf8mb4_unicode_ci LIMIT 1;
      SET v_done = 0;
      IF v_error_type IS NULL THEN
        INSERT IGNORE INTO unmapped_rc (id_app_identifier,jenis_transaksi,rc,rc_description,status_transaksi,error_type)
        VALUES (v_app_id,v_jenis_transaksi,v_normalized_rc,v_rc_description,v_status_transaksi,NULL);
      END IF;
    END IF;
    IF v_is_rc_empty THEN
      IF v_is_success THEN SET v_normalized_rc='00'; SET v_error_type='Sukses';
      ELSE SET v_error_type=NULL; END IF;
    END IF;
    INSERT INTO app_success_rate (
      id_app_identifier,tanggal_transaksi,bulan,tahun,jenis_transaksi,rc,rc_description,
      total_transaksi,total_nominal,total_biaya_admin,status_transaksi,error_type
    ) VALUES (
      v_app_id,v_tanggal_transaksi,v_bulan,v_tahun,v_jenis_transaksi,v_normalized_rc,v_rc_description,
      v_total_transaksi,v_total_nominal,v_total_biaya_admin,v_status_transaksi,v_error_type
    );
    SET v_records_inserted = v_records_inserted + 1;
  END LOOP;
  CLOSE cur_bale_data;
  COMMIT;

  UPDATE app_processing_log
  SET status='success', end_time=NOW(), records_processed=v_records_processed, records_inserted=v_records_inserted
  WHERE id=v_log_id;
END
