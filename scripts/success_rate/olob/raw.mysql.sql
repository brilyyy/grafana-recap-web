-- DEPRECATED: MySQL not supported for new work. Use the .postgres.sql variant.

-- Set before running: SET @olob_start_date = '2026-03-05 00:00:00'; SET @olob_end_date = '2026-03-06 00:00:00'; SET @api_name = 'SelectBankAccountType';
SELECT 
    date(log_dt) AS 'Tanggal Transaksi',
    @api_name AS 'Jenis Transaksi',
    substring(log_msg, POSITION('status_code' IN log_msg), 18) AS 'RC',
    COUNT(substring(log_msg, POSITION('status_code' IN log_msg), 18)) AS 'Total Transaksi'
FROM openaccount_syslog
WHERE log_dt >= @olob_start_date 
  AND log_dt < @olob_end_date 
  AND log_msg LIKE CONCAT('%', @api_name, '%')
GROUP BY 1, 2, 3
ORDER BY 1;

-- @api_name list
-- SelectBankAccountType
-- UploadIdentityCard
-- RequestOpenAccount
-- RequestEmailOTP
-- VerifyEmail
-- RequestMobilePhoneOTP
-- VerifyMobilePhone
-- SubmitCustomerData
-- SaveCardInfo
-- RegisterEChannel
-- ChooseKYCMethod
-- VerifyLivenessResult

