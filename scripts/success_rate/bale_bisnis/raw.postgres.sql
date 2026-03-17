WITH rbb AS (
  SELECT * FROM raw_bale_bisnis
),
days AS (
  -- Deret tanggal sesuai input parameter
  SELECT d::timestamp AS transaction_date
  FROM generate_series(
    $1::timestamp,
    $2::timestamp,
    interval '1 day'
  ) AS g(d)
),
features AS (
  -- Daftar transaction category
  SELECT DISTINCT rbb.transaction_category
  FROM raw_bale_bisnis rbb
  WHERE rbb.transaction_date >= $1::timestamp
    AND rbb.transaction_date <  $2::timestamp
),
statuses AS (
  -- Semua transaction_status
  SELECT * FROM (VALUES
    (0, 'SUCCESS'),
    (1, 'FAILED'),
    (2, 'SUSPECT'),
    (3, 'WAITING'),
    (4, 'REJECTED')
  ) AS s(status_code, transaction_status)
),
states AS (
  -- Semua transaction_state
  SELECT * FROM (VALUES
    (0, 'INQUIRY'),
    (1, 'EXECUTE'),
    (2, 'EXECUTE_SCHEDULER'),
    (3, 'INQUIRY_PARTIAL'),
    (4, 'SCHEDULED')
  ) AS st(state_code, transaction_state)
),
agg AS (
  -- Agregasi per hari × category × status × state × result_code
  SELECT
      rbb.transaction_date::date AS transaction_date,
      rbb.transaction_category,
      rbb.transaction_status,
      rbb.transaction_state,
      rbb.result_code,
      rbb.result_code_desc,
      COUNT(*)                               AS transaction_count,
      COALESCE(SUM(rbb.transaction_amount),0) AS transaction_amount,
      COALESCE(SUM(rbb.admin_fee),0)          AS total_admin_fee
  FROM raw_bale_bisnis rbb
  WHERE rbb.transaction_date >= $1::timestamp
    AND rbb.transaction_date <  $2::timestamp
    AND rbb.transaction_count != 0
  GROUP BY 1,2,3,4,5,6
)
SELECT
    d.transaction_date                    AS "Tanggal Transaksi",
    f.transaction_category                AS "Jenis Transaksi",
    s.transaction_status                  AS "Status Transaksi",
    COALESCE(a.transaction_count, 0)      AS "Total Transaksi",
    COALESCE(a.transaction_amount, 0)     AS "Total Nominal",
    COALESCE(a.total_admin_fee, 0)        AS "Total Biaya Admin",
    COALESCE(a.result_code, '-')          AS "RC",
    COALESCE(a.result_code_desc, '-')     AS "RC Description"
FROM days d
CROSS JOIN features f
CROSS JOIN statuses s
CROSS JOIN states st
LEFT JOIN agg a
  ON a.transaction_date   = d.transaction_date
AND a.transaction_category = f.transaction_category
AND a.transaction_status = s.status_code
AND a.transaction_state  = st.state_code
ORDER BY
    d.transaction_date,
    f.transaction_category,
    s.transaction_status,
    st.transaction_state,
    a.result_code NULLS LAST;
