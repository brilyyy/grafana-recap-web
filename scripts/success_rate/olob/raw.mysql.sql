SELECT date(log_dt) AS 'Tanggal Transaksi', substring(log_msg, POSITION('status_code' IN log_msg), 18) AS status_code, COUNT(substring(log_msg, POSITION('status_code' IN log_msg), 18)) as jumlah FROM openaccount_syslog WHERE  
log_dt >= @start_date AND  
log_dt < @end_date AND  
log_msg LIKE '%@api_name%'  
GROUP BY date(log_dt), substring(log_msg, POSITION('status_code' IN log_msg), 18);

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