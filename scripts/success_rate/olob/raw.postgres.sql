SELECT 
    log_dt::date AS "Tanggal Transaksi",
    $3 AS "Jenis Transaksi",
    SUBSTRING(log_msg FROM POSITION('status_code' IN log_msg) FOR 18) AS "RC",
    COUNT(SUBSTRING(log_msg FROM POSITION('status_code' IN log_msg) FOR 18))::INT AS "Total Transaksi"
FROM openaccount_syslog
WHERE log_dt >= $1::timestamp
  AND log_dt < $2::timestamp
  AND log_msg LIKE '%' || $3 || '%'
GROUP BY 
    "Tanggal Transaksi",
    "Jenis Transaksi",
    "RC"
ORDER BY 
    "Tanggal Transaksi";

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