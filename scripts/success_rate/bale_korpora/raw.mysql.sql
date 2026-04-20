SELECT 
    a.ACTN_DT AS `Tanggal Transaksi`, 
    a.SRVC_NM AS `Jenis Transaksi`, 
    a.ERR_MAP_CD AS `RC`, 
    a.ERR_MAP_NM AS `RC Description`, 
    COUNT(DISTINCT a.ID) AS `Total Transaksi`, 
    SUM(a.AMT) AS `Total Nominal`,
    0 AS `Total Biaya Admin`,
    CASE
        WHEN a.IS_ERR = 'N' THEN 'Sukses'
        WHEN a.IS_ERR = 'Y' THEN 'Gagal'
        ELSE 'Status Tidak Dikenal'
    END AS `Status Transaksi`
FROM 
    bale_korpora_db_GCM_AGCM_LOG_ACTV a
WHERE
    DATE(a.ACTN_DT) = CAST(? AS DATE)
GROUP BY
    `Tanggal Transaksi`,
    `Jenis Transaksi`,
    `RC`,
    `RC Description`,
    `Status Transaksi`;