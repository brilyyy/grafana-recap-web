-- Housekeeping procedure for openaccount_syslog table / OLOB (MySQL)
-- Deletes rows older than p_retention_days from the current date.
DROP PROCEDURE IF EXISTS sp_housekeep_raw_olob;

CREATE PROCEDURE sp_housekeep_raw_olob(IN p_retention_days INT)
BEGIN
  DECLARE v_cutoff_date DATE;
  SET v_cutoff_date = DATE_SUB(CURDATE(), INTERVAL p_retention_days DAY);
  DELETE FROM openaccount_syslog WHERE log_dt < v_cutoff_date;
END;
