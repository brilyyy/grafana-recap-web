CREATE PROCEDURE sp_process_bale_bisnis_daily(IN p_processing_date DATE)
MODIFIES SQL DATA
SQL SECURITY DEFINER
BEGIN
  DECLARE v_app_id INT;
  DECLARE v_app_name VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'Bale Bisnis';
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

  DECLARE cur_bisnis_data CURSOR FOR
    WITH days AS (
      SELECT v_processing_date AS transaction_date
    ),
    features AS (
      SELECT DISTINCT rbb.transaction_category
      FROM `bale_bisnis_db`.`raw_bale_bisnis` rbb
      WHERE rbb.transaction_date >= v_start_timestamp
        AND rbb.transaction_date <  v_end_timestamp + INTERVAL 1 SECOND
    ),
    statuses AS (
      SELECT 0 AS status_code, 'SUCCESS' AS transaction_status UNION ALL
      SELECT 1, 'FAILED'   UNION ALL
      SELECT 2, 'SUSPECT'  UNION ALL
      SELECT 3, 'WAITING'  UNION ALL
      SELECT 4, 'REJECTED'
    ),
    states AS (
      SELECT 0 AS state_code, 'INQUIRY'            AS transaction_state UNION ALL
      SELECT 1, 'EXECUTE'           UNION ALL
      SELECT 2, 'EXECUTE_SCHEDULER' UNION ALL
      SELECT 3, 'INQUIRY_PARTIAL'   UNION ALL
      SELECT 4, 'SCHEDULED'
    ),
    agg AS (
      SELECT
          DATE(rbb.transaction_date)              AS transaction_date,
          rbb.transaction_category,
          rbb.transaction_status,
          rbb.transaction_state,
          rbb.result_code,
          rbb.result_code_desc,
          COUNT(*)                                AS transaction_count,
          COALESCE(SUM(rbb.transaction_amount),0) AS transaction_amount,
          COALESCE(SUM(rbb.admin_fee),0)          AS total_admin_fee
      FROM `bale_bisnis_db`.`raw_bale_bisnis` rbb
      WHERE rbb.transaction_date >= v_start_timestamp
        AND rbb.transaction_date <  v_end_timestamp + INTERVAL 1 SECOND
        AND rbb.transaction_count != 0
      GROUP BY 1,2,3,4,5,6
    )
    SELECT
        d.transaction_date                    AS `Tanggal Transaksi`,
        f.transaction_category                AS `Jenis Transaksi`,
        s.transaction_status                  AS `Status Transaksi`,
        COALESCE(a.transaction_count, 0)      AS `Total Transaksi`,
        COALESCE(a.transaction_amount, 0)     AS `Total Nominal`,
        COALESCE(a.total_admin_fee, 0)        AS `Total Biaya Admin`,
        COALESCE(a.result_code, '-')          AS `RC`,
        COALESCE(a.result_code_desc, '-')     AS `RC Description`
    FROM days d
    CROSS JOIN features f
    CROSS JOIN statuses s
    CROSS JOIN states st
    LEFT JOIN agg a
      ON a.transaction_date    = d.transaction_date
     AND a.transaction_category = f.transaction_category
     AND a.transaction_status   = s.status_code
     AND a.transaction_state    = st.transaction_state
    ORDER BY
        d.transaction_date,
        f.transaction_category,
        s.transaction_status,
        st.state_code,
        a.result_code IS NULL,
        a.result_code;

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
  IF v_app_id IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Application Bale Bisnis not found in app_identifier table'; END IF;

  INSERT INTO app_processing_log (app_name, id_app_identifier, processing_date, start_time, status)
  VALUES (v_app_name, v_app_id, v_processing_date, NOW(), 'running');
  SET v_log_id = LAST_INSERT_ID();
  IF v_log_id IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Failed to create processing log entry'; END IF;

  START TRANSACTION;
  DELETE FROM app_success_rate WHERE id_app_identifier=v_app_id AND tanggal_transaksi=v_processing_date;

  SET v_done = 0;
  OPEN cur_bisnis_data;
  read_loop: LOOP
    FETCH cur_bisnis_data INTO v_tanggal_transaksi,v_jenis_transaksi,v_status_transaksi,
      v_total_transaksi,v_total_nominal,v_total_biaya_admin,v_rc,v_rc_description;
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
  CLOSE cur_bisnis_data;
  COMMIT;

  UPDATE app_processing_log
  SET status='success', end_time=NOW(), records_processed=v_records_processed, records_inserted=v_records_inserted
  WHERE id=v_log_id;
END
