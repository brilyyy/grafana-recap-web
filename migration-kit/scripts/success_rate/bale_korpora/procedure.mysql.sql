-- DEPRECATED: MySQL not supported for new work. Use the .postgres.sql variant.

CREATE PROCEDURE sp_process_bale_korpora_daily(IN p_processing_date DATE)
MODIFIES SQL DATA
SQL SECURITY DEFINER
BEGIN
  DECLARE v_app_id INT;
  DECLARE v_app_name VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'Bale Korpora';
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
  DECLARE v_rc VARCHAR(255);
  DECLARE v_rc_description VARCHAR(500);
  DECLARE v_total_transaksi INT;
  DECLARE v_total_nominal DECIMAL(20,2);
  DECLARE v_total_biaya_admin DECIMAL(20,2);
  DECLARE v_status_transaksi VARCHAR(255);
  DECLARE v_bulan VARCHAR(20);
  DECLARE v_tahun INT;
  DECLARE v_error_type VARCHAR(255);
  DECLARE v_normalized_rc VARCHAR(255);
  DECLARE v_normalized_rc_desc VARCHAR(500);
  DECLARE v_normalized_status VARCHAR(255);
  DECLARE v_is_rc_empty BOOLEAN;
  DECLARE v_is_success BOOLEAN;

  DECLARE cur_bale_korpora_data CURSOR FOR
    SELECT
      DATE(a.ACTN_DT)                     AS `Tanggal Transaksi`,
      COALESCE(NULLIF(TRIM(COALESCE(a.SRVC_NM, '')), ''), '(tidak ada jenis transaksi)') AS `Jenis Transaksi`,
      a.ERR_MAP_CD                        AS `RC`,
      a.ERR_MAP_NM                        AS `RC Description`,
      COUNT(DISTINCT a.ID)                AS `Total Transaksi`,
      COALESCE(SUM(a.AMT), 0)             AS `Total Nominal`,
      0                                   AS `Total Biaya Admin`,
      CASE
        WHEN a.IS_ERR = 'N' THEN 'Sukses'
        WHEN a.IS_ERR = 'Y' THEN 'Gagal'
        ELSE 'Status Tidak Dikenal'
      END                                 AS `Status Transaksi`
    FROM bale_korpora_db_GCM_AGCM_LOG_ACTV a
    WHERE a.ACTN_DT >= v_start_timestamp
      AND a.ACTN_DT <= v_end_timestamp
    GROUP BY
      DATE(a.ACTN_DT),
      COALESCE(NULLIF(TRIM(COALESCE(a.SRVC_NM, '')), ''), '(tidak ada jenis transaksi)'),
      a.ERR_MAP_CD,
      a.ERR_MAP_NM,
      a.IS_ERR
    ORDER BY DATE(a.ACTN_DT), COALESCE(NULLIF(TRIM(COALESCE(a.SRVC_NM, '')), ''), '(tidak ada jenis transaksi)');

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
  IF v_app_id IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Application Bale Korpora not found in app_identifier table'; END IF;

  INSERT INTO app_processing_log (app_name, id_app_identifier, processing_date, start_time, status)
  VALUES (v_app_name, v_app_id, v_processing_date, NOW(), 'running');
  SET v_log_id = LAST_INSERT_ID();
  IF v_log_id IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Failed to create processing log entry'; END IF;

  START TRANSACTION;
  DELETE FROM app_success_rate WHERE id_app_identifier=v_app_id AND tanggal_transaksi=v_processing_date;

  SET v_done = 0;
  OPEN cur_bale_korpora_data;
  read_loop: LOOP
    FETCH cur_bale_korpora_data INTO v_tanggal_transaksi, v_jenis_transaksi, v_rc, v_rc_description,
      v_total_transaksi, v_total_nominal, v_total_biaya_admin, v_status_transaksi;
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
        VALUES (v_app_id,v_jenis_transaksi,IFNULL(v_normalized_rc,''),IFNULL(v_rc_description,''),v_status_transaksi,NULL);
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
      v_total_transaksi,v_total_nominal,v_total_biaya_admin,v_status_transaksi,v_error_type
    );
    SET v_records_inserted = v_records_inserted + 1;
  END LOOP;
  CLOSE cur_bale_korpora_data;
  COMMIT;

  UPDATE app_processing_log
  SET status='success', end_time=NOW(), records_processed=v_records_processed, records_inserted=v_records_inserted
  WHERE id=v_log_id;
END

