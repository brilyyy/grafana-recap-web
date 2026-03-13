SELECT 
    TO_DATE(SUBSTRING("TRXMDT"::text FROM 2), 'YYMMDD')::date AS "Tanggal Transaksi",
    "TRRSPC" as "RC",
    "RSSHTD" as "RC Description",
    count("TRRSPC") as "Total Transaksi",
    SUM("TRTRN$") as "Total Nominal" 
FROM  
"ASID160448_ZTRANS0P", "ASID160448_ZRSPCD0P" where "TRRSPC"="RSRSPC"                       
and "TRTRTY" not in ('21', '6A', '6B', 'C1', 'C2')                       
and "TRPROD" = 'POS'                              
and "TRXMDT" = (1000000 + (EXTRACT(YEAR FROM $1::date)::int % 100) * 10000 + EXTRACT(MONTH FROM $1::date)::int * 100 + EXTRACT(DAY FROM $1::date)::int)
group by "Tanggal Transaksi","RC","RC Description" order by "Total Transaksi" desc