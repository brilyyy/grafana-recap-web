-- Representative aggregation for Bale Korpora recap by ACTN_BY_CUST_ID (corp_id): same split as
-- scripts/success_rate/bale_korpora/procedure.postgres.sql (jenis, RC, RC Description, Status via IS_ERR),
-- plus grouping by corporation so each row is a per-corp daily slice of activity.
-- error_type is not selected here; sp_recap_bale_korpora_corp_daily fills it via response_code_dictionary
-- (Bale Korpora app id), same rules as sp_process_bale_korpora_daily (including unmapped_rc from the procedure).
--
-- Date filter — MUST match sp_recap_bale_korpora_corp_daily:
--   v_start_timestamp := p_processing_date::timestamp
--   v_end_timestamp   := (p_processing_date + interval '1 day' - interval '1 second')::timestamp
-- Ad-hoc: pass start/end as $1 / $2 (timestamps), or compute from a single date in your client.
--
-- Source: foreign table "bale_korpora_db_GCM_AGCM_LOG_ACTV"
SELECT *
FROM (
  SELECT
    date(a."ACTN_DT") AS "Tanggal Transaksi",
    COALESCE(NULLIF(BTRIM(a."ACTN_BY_CUST_ID"::text), ''), '(unknown)') AS corp_id,
    COALESCE(NULLIF(BTRIM(COALESCE(a."SRVC_NM"::text, '')), ''), '(tidak ada jenis transaksi)') AS "Jenis Transaksi",
    a."ERR_MAP_CD"::text AS "RC",
    a."ERR_MAP_NM"::text AS "RC Description",
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
    a."ERR_MAP_CD",
    a."ERR_MAP_NM",
    a."IS_ERR"
) AS bale_korpora_corp_rollup
ORDER BY bale_korpora_corp_rollup.corp_id, bale_korpora_corp_rollup."Jenis Transaksi";
