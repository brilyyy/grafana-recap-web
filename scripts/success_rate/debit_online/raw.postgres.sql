SELECT 
    TO_DATE(SUBSTRING(t."TRXMDT"::text FROM 2), 'YYMMDD')::date AS "Tanggal Transaksi",
    t."TRRSPC" AS "RC",
    r."RSSHTD" AS "RC Description",
    count(t."TRRSPC") AS "Total Transaksi",
    SUM(t."TRTRN$") AS "Total Nominal"
FROM "ASID160448_ZTRANS0P" t
JOIN "ASID160448_ZRSPCD0P" r ON t."TRRSPC" = r."RSRSPC"
WHERE t."TRTRTY" = '21'
  AND t."TRPCCD" = 59
  AND t."TRXMDT" = (
    1000000 + (EXTRACT(YEAR FROM $1::date)::int % 100) * 10000
    + EXTRACT(MONTH FROM $1::date)::int * 100
    + EXTRACT(DAY FROM $1::date)::int
  )
GROUP BY t."TRXMDT", t."TRRSPC", r."RSSHTD"
ORDER BY count(t."TRRSPC") DESC;
