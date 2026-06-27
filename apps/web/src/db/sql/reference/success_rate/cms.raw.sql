SELECT 
	a."ACTN_DT" as "Tanggal Transaksi", 
	a."SRVC_NM" as "Jenis Transaksi", 
	a."ERR_MAP_CD" as "RC", 
	a."ERR_MAP_NM" as "RC Description", 
	COUNT(DISTINCT a."ID") as "Total Transaksi", 
	SUM(a."AMT") as "Total Nominal",
	0 as "Total Biaya Admin",
	CASE
		WHEN a."IS_ERR" = 'N' THEN 'Sukses'
		WHEN a."IS_ERR" = 'Y' THEN 'Gagal'
	ELSE
		'Status Tidak Dikenal'
	END AS "Status Transaksi"
FROM 
	"cms_db_GCM_AGCM_LOG_ACTV" a
WHERE
	date(a."ACTN_DT") = $1::date
GROUP BY
	"Tanggal Transaksi",
	"Jenis Transaksi",
	"RC",
	"RC Description",
	"Status Transaksi"