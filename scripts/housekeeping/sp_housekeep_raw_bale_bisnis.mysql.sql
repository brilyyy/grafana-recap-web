-- DEPRECATED: MySQL not supported for new work. Use the .postgres.sql variant.

-- Housekeeping procedure for raw_bale_bisnis table (MySQL)
-- Deletes rows older than p_retention_days from the current date.
DROP PROCEDURE IF EXISTS sp_housekeep_raw_bale_bisnis;

CREATE PROCEDURE sp_housekeep_raw_bale_bisnis(IN p_retention_days INT)
BEGIN
  DECLARE v_cutoff_date DATE;
  SET v_cutoff_date = DATE_SUB(CURDATE(), INTERVAL p_retention_days DAY);
  DELETE FROM raw_bale_bisnis WHERE transaction_date < v_cutoff_date;
END;

