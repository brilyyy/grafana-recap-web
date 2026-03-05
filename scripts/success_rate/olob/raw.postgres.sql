SELECT 
    log_dt::date AS "Tanggal Transaksi",
    SUBSTRING(log_msg FROM POSITION('status_code' IN log_msg) FOR 18) AS status_code,
    COUNT(
        SUBSTRING(log_msg FROM POSITION('status_code' IN log_msg) FOR 18)
    ) AS jumlah
FROM openaccount_syslog
WHERE log_dt >= $1
  AND log_dt < $2
  AND log_msg LIKE '%@api_name%'
GROUP BY 
    log_dt::date,
    SUBSTRING(log_msg FROM POSITION('status_code' IN log_msg) FOR 18)
ORDER BY 
    log_dt::date;

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