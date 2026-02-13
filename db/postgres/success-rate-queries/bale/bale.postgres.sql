WITH categories AS ( 
    SELECT unnest(ARRAY[ 
        'ACTIVATE_DORMANT', 'BILLPAYMENT_BANK_LOAN', 'BILLPAYMENT_BPJS_KESEHATAN', 'BILLPAYMENT_BPJS_TENAGA_KERJA', 
        'BILLPAYMENT_CREDIT_CARD', 'BILLPAYMENT_CREDIT_CARD_OrbER', 'BILLPAYMENT_DONATION_ACT', 
        'BILLPAYMENT_DONATION_BAZNAS', 'BILLPAYMENT_DONATION_DOMPET', 'BILLPAYMENT_ECOM_BUKALAPAK', 
        'BILLPAYMENT_ECOM_TOKOPEDIA', 'BILLPAYMENT_EDUCATION', 'BILLPAYMENT_INSURANCE', 
        'BILLPAYMENT_INTERNET_TV', 'BILLPAYMENT_MPN', 'BILLPAYMENT_MULTIBILLER', 
        'BILLPAYMENT_MULTIBILLER_LEGAL', 'BILLPAYMENT_NON_PBB', 'BILLPAYMENT_OrbER_LOAN', 'BILLPAYMENT_PBB', 
        'BILLPAYMENT_PDAM', 'BILLPAYMENT_PEGADAIAN', 'BILLPAYMENT_PGN', 'BILLPAYMENT_PHONE', 
        'BILLPAYMENT_PLN', 'BILLPAYMENT_TICKET_TRAIN', 'BILLPAYMENT_TRANSPORTATION', 'BILLPAYMENT_VA', 
        'BILLPAYMENT_VA_MORTGAGE', 'BILLPAYMENT_VEHICLE_TAX', 'BUY_MUTUAL_FUND', 'BUY_SBN', 
        'CARDLESS_DEPOSIT', 'CARDLESS_WIrbDRAWAL', 'EDEPOSITO_PLACEMENT', 'EDEPOSITO_WIrbDRAWAL', 
        'FREEZE_PROXY_BIFAST', 'MONEY_CHANGER', 'PORTING_PROXY_BIFAST', 
        'PURCHASE_EVOUCHER_MTIX', 'PURCHASE_EVOUCHER_STREAMING', 'PURCHASE_NFC_EMONEY', 
        'PURCHASE_NFC_FLAZZ', 'PURCHASE_NFC_TAPCASH', 'PURCHASE_PHONE', 'PURCHASE_PLN_PREPAID', 
        'PURCHASE_TOPUP_DANA', 'PURCHASE_TOPUP_GOPAY', 'PURCHASE_TOPUP_ISAKU', 'PURCHASE_TOPUP_LINKAJA', 
        'PURCHASE_TOPUP_OVO', 'PURCHASE_TOPUP_POSPAY', 'PURCHASE_TOPUP_SHOPEEPAY', 'QR_CROSS_BORDER', 
        'QR_MPM', 'REGISTRATION_PROXY_BIFAST', 'SELL_MUTUAL_FUND', 'SWITCH_FROM_MUTUAL_FUND', 
        'SWITCH_TO_MUTUAL_FUND', 'TRANSFER_ALL', 'TRANSFER_BIFAST', 'TRANSFER_FOREX_OA', 
        'TRANSFER_FOREX_ON_US', 'TRANSFER_OA', 'TRANSFER_OFF_US', 'TRANSFER_ON_US', 'TRANSFER_RTGS', 
        'TRANSFER_SKN', 'TRANSFER_SPLIT_BILL', 'TRANSFER_SWIFT', 'UNFREEZE_PROXY_BIFAST', 
        'UNREGISTRATION_PROXY_BIFAST', 'UPDATE_PROXY_BIFAST' 
    ]) AS category 
) 
SELECT 
    to_char(rb.transaction_date,'YYYY-MM-DD') AS "Tanggal Transaksi", 
    rb.transaction_category AS "Jenis Transaksi", 
    rb.result_code AS "RC", 
    rb.result_code_desc AS "RC Description", 
    count(DISTINCT rb.id) AS "total transaksi", 
    SUM(rb.transaction_amount) AS "Total Nominal", 
    SUM(rb.transaction_fee) AS "Total Biaya Admin", 
    CASE  
        WHEN rb.transaction_status = 0 THEN 'Success' 
        WHEN rb.transaction_status = 1 THEN 'Failed' 
        WHEN rb.transaction_status = 2 THEN 'Pending' 
        WHEN rb.transaction_status = 9 THEN 'ACK' 
        WHEN rb.transaction_status = 8 THEN 'REVERSAL' 
        ELSE 'Status Tidak Dikenal' 
    END AS "Status Transaksi"  
FROM 
    raw_bale rb 
    JOIN categories c ON rb.transaction_category = c.category 
WHERE 
    rb.transaction_state IN ('1','9','8') 
    AND rb.transaction_date BETWEEN $1 AND $2 
GROUP BY 
    "Tanggal Transaksi",rb.transaction_category,rb.result_code ,rb.result_code_desc , rb.transaction_status  
ORDER BY 
    "Tanggal Transaksi" DESC;
