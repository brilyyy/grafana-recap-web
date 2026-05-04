SELECT
  date(a."ACTN_DT") AS "Tanggal Transaksi",
  COALESCE(NULLIF(BTRIM(a."ACTN_BY_CUST_ID"::text), ''), '(unknown)') AS corp_id,
  COALESCE(NULLIF(BTRIM(COALESCE(a."SRVC_NM"::text, '')), ''), '(tidak ada jenis transaksi)') AS "Jenis Transaksi",
  COALESCE(a."ERR_MAP_CD"::text, '') AS "RC",
  COALESCE(a."ERR_MAP_NM"::text, '') AS "RC Description",
  COUNT(DISTINCT a."ID")::INT AS "Total Transaksi",
  COALESCE(SUM(a."AMT"), 0) AS "Total Nominal",
  CASE
    WHEN a."IS_ERR" = 'N' THEN 'Sukses'
    WHEN a."IS_ERR" = 'Y' THEN 'Gagal'
    ELSE 'Status Tidak Dikenal'
  END AS "Status Transaksi"
FROM "bale_korpora_db_GCM_AGCM_LOG_ACTV" a
WHERE a."ACTN_DT" >= $1::timestamp
  AND a."ACTN_DT" <= $2::timestamp
GROUP BY
  date(a."ACTN_DT"),
  COALESCE(NULLIF(BTRIM(a."ACTN_BY_CUST_ID"::text), ''), '(unknown)'),
  COALESCE(NULLIF(BTRIM(COALESCE(a."SRVC_NM"::text, '')), ''), '(tidak ada jenis transaksi)'),
  COALESCE(a."ERR_MAP_CD"::text, ''),
  COALESCE(a."ERR_MAP_NM"::text, ''),
  CASE
    WHEN a."IS_ERR" = 'N' THEN 'Sukses'
    WHEN a."IS_ERR" = 'Y' THEN 'Gagal'
    ELSE 'Status Tidak Dikenal'
  END
