-- DEPRECATED: MySQL not supported for new work. Use the .postgres.sql variant.

CREATE PROCEDURE sp_process_olob_daily(IN p_processing_date DATE)
MODIFIES SQL DATA
SQL SECURITY DEFINER
BEGIN
  DECLARE v_app_id INT;
  DECLARE v_app_name VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'OLOB';
  DECLARE v_start_timestamp DATETIME;
  DECLARE v_end_timestamp DATETIME;
  DECLARE v_processing_date DATE;
  DECLARE v_log_id INT;
  DECLARE v_error_msg TEXT;
  DECLARE v_records_processed INT DEFAULT 0;
  DECLARE v_records_inserted INT DEFAULT 0;
  DECLARE v_done INT DEFAULT 0;
  DECLARE v_api_name VARCHAR(255);
  DECLARE v_tanggal_transaksi DATE;
  DECLARE v_jenis_transaksi VARCHAR(255);
  DECLARE v_rc VARCHAR(50);
  DECLARE v_rc_description VARCHAR(500);
  DECLARE v_total_transaksi INT;
  DECLARE v_bulan VARCHAR(20);
  DECLARE v_tahun INT;
  DECLARE v_error_type VARCHAR(255);
  DECLARE v_normalized_rc VARCHAR(50);
  DECLARE v_normalized_rc_desc VARCHAR(500);
  DECLARE v_normalized_status VARCHAR(255);
  DECLARE v_is_rc_empty BOOLEAN;
  DECLARE v_is_success BOOLEAN;

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
  SET @olob_start_date = v_start_timestamp;
  SET @olob_end_date = v_end_timestamp + INTERVAL 1 SECOND;

  SET v_done = 0;
  SELECT id INTO v_app_id FROM app_identifier
  WHERE app_name COLLATE utf8mb4_unicode_ci = v_app_name COLLATE utf8mb4_unicode_ci LIMIT 1;
  SET v_done = 0;
  IF v_app_id IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Application OLOB not found in app_identifier table'; END IF;

  INSERT INTO app_processing_log (app_name, id_app_identifier, processing_date, start_time, status)
  VALUES (v_app_name, v_app_id, v_processing_date, NOW(), 'running');
  SET v_log_id = LAST_INSERT_ID();
  IF v_log_id IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Failed to create processing log entry'; END IF;

  START TRANSACTION;
  DELETE FROM app_success_rate WHERE id_app_identifier=v_app_id AND tanggal_transaksi=v_processing_date;

  BLOCK_API: BEGIN
    DECLARE cur_api_names CURSOR FOR SELECT api_name FROM (
      SELECT 'SelectBankAccountType' AS api_name UNION ALL SELECT 'UploadIdentityCard' UNION ALL SELECT 'RequestOpenAccount'
      UNION ALL SELECT 'RequestEmailOTP' UNION ALL SELECT 'VerifyEmail' UNION ALL SELECT 'RequestMobilePhoneOTP'
      UNION ALL SELECT 'VerifyMobilePhone' UNION ALL SELECT 'SubmitCustomerData' UNION ALL SELECT 'SaveCardInfo'
      UNION ALL SELECT 'RegisterEChannel' UNION ALL SELECT 'ChooseKYCMethod' UNION ALL SELECT 'VerifyLivenessResult'
    ) AS api_list;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = 1;

    OPEN cur_api_names;
    api_loop: LOOP
      SET v_done = 0;
      FETCH cur_api_names INTO v_api_name;
      IF v_done THEN LEAVE api_loop; END IF;

      BLOCK_QUERY: BEGIN
        DECLARE v_txn_date DATE;
        DECLARE v_status_code VARCHAR(50);
        DECLARE v_jumlah INT;
        DECLARE v_qdone INT DEFAULT 0;
        DECLARE cur_result CURSOR FOR
          SELECT date(log_dt) AS Tanggal_Transaksi,
                 substring(log_msg, POSITION('status_code' IN log_msg), 18) AS status_code,
                 COUNT(substring(log_msg, POSITION('status_code' IN log_msg), 18)) AS jumlah
          FROM `olob_db`.`openaccount_syslog`
          WHERE log_dt >= @olob_start_date AND log_dt < @olob_end_date AND log_msg LIKE CONCAT('%', v_api_name, '%')
          GROUP BY date(log_dt), substring(log_msg, POSITION('status_code' IN log_msg), 18)
          ORDER BY date(log_dt);
        DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_qdone = 1;
        SET v_qdone = 0;
        SET v_done = 0;
        OPEN cur_result;
        result_loop: LOOP
          FETCH cur_result INTO v_txn_date, v_status_code, v_jumlah;
          IF v_qdone THEN LEAVE result_loop; END IF;

          SET v_records_processed = v_records_processed + 1;
          SET v_tanggal_transaksi = v_txn_date;
          SET v_jenis_transaksi = v_api_name;
          SET v_rc = v_status_code;
          SET v_rc_description = v_status_code;
          SET v_total_transaksi = v_jumlah;
          SET v_bulan = MONTH(v_tanggal_transaksi);
          SET v_tahun = YEAR(v_tanggal_transaksi);
          SET v_normalized_rc = NULLIF(TRIM(COALESCE(v_rc,'')), '');
          SET v_normalized_rc = NULLIF(v_normalized_rc, '-');
          SET v_is_rc_empty = (v_normalized_rc IS NULL OR v_normalized_rc='' OR v_normalized_rc='-');
          SET v_normalized_rc_desc = LOWER(TRIM(COALESCE(v_rc_description,'')));
          SET v_normalized_status = LOWER(TRIM(COALESCE(v_rc,'')));
          SET v_is_success = (
            v_normalized_rc_desc IN ('sukses','success','berhasil') OR v_normalized_rc_desc LIKE '%sukses%' OR v_normalized_rc_desc LIKE '%success%' OR v_normalized_rc_desc LIKE '%berhasil%' OR
            v_normalized_status IN ('sukses','success','berhasil') OR v_normalized_status LIKE '%sukses%' OR v_normalized_status LIKE '%success%' OR v_normalized_status LIKE '%berhasil%'
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
              VALUES (v_app_id,v_jenis_transaksi,IFNULL(v_normalized_rc,''),IFNULL(v_rc_description,''),v_rc,NULL);
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
            v_app_id,v_tanggal_transaksi,v_bulan,v_tahun,v_jenis_transaksi,IFNULL(v_normalized_rc,''),IFNULL(v_rc_description,''),
            v_total_transaksi,0,0,v_rc,v_error_type
          );
          SET v_records_inserted = v_records_inserted + 1;
        END LOOP;
        CLOSE cur_result;
      END BLOCK_QUERY;
    END LOOP;
    CLOSE cur_api_names;
  END BLOCK_API;

  COMMIT;

  UPDATE app_processing_log
  SET status='success', end_time=NOW(), records_processed=v_records_processed, records_inserted=v_records_inserted
  WHERE id=v_log_id;
END;

