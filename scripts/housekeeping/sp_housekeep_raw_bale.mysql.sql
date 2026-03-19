-- Housekeeping procedure for raw_bale table (MySQL)
-- Deletes rows older than p_retention_days from the current date.
-- Run in bale_db.
DROP PROCEDURE IF EXISTS sp_housekeep_raw_bale;

CREATE PROCEDURE sp_housekeep_raw_bale(IN p_retention_days INT)
BEGIN
  DECLARE v_cutoff_date DATE;
  SET v_cutoff_date = DATE_SUB(CURDATE(), INTERVAL p_retention_days DAY);
  DELETE FROM raw_bale WHERE transaction_date < v_cutoff_date;
END;
