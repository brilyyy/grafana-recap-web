-- Representative aggregation for CMS recap by CORP_ID with the same business dimensions as
-- scripts/success_rate/cms/raw.postgres.sql (Jenis Transaksi, RC, RC Description, totals, Status).
--
-- Date filter — MUST match sp_recap_cms_corp_daily:
--   v_start_timestamp := p_processing_date::timestamp
--   v_end_timestamp   := (p_processing_date + interval '1 day' - interval '1 second')::timestamp
-- Ad-hoc: pass start/end as $1 / $2 (timestamps), or compute from a single date in your client.
--
-- Source: foreign table "cms_db_GCM_AGCM_LOG_ACTV"
SELECT
  date(a."ACTN_DT") AS "Tanggal Transaksi",
  COALESCE(NULLIF(BTRIM(a."CORP_ID"::text), ''), '(unknown)') AS corp_id,
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
FROM "cms_db_GCM_AGCM_LOG_ACTV" a
WHERE a."ACTN_DT" >= $1::timestamp
  AND a."ACTN_DT" <= $2::timestamp
GROUP BY
  date(a."ACTN_DT"),
  COALESCE(NULLIF(BTRIM(a."CORP_ID"::text), ''), '(unknown)'),
  COALESCE(NULLIF(BTRIM(COALESCE(a."SRVC_NM"::text, '')), ''), '(tidak ada jenis transaksi)'),
  COALESCE(a."ERR_MAP_CD"::text, ''),
  COALESCE(a."ERR_MAP_NM"::text, ''),
  CASE
    WHEN a."IS_ERR" = 'N' THEN 'Sukses'
    WHEN a."IS_ERR" = 'Y' THEN 'Gagal'
    ELSE 'Status Tidak Dikenal'
  END
ORDER BY
  date(a."ACTN_DT"),
  corp_id,
  "Jenis Transaksi",
  "RC";
