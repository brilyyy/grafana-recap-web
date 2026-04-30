-- DEPRECATED: MySQL not supported for new work. Use the .postgres.sql variant.

WITH rbb AS (
  SELECT * FROM raw_bale_bisnis
),
days AS (
  -- Deret tanggal sesuai input parameter
  SELECT DATE_ADD(start_date, INTERVAL seq DAY) AS transaction_date
  FROM (
    SELECT @start_date AS start_date,
           DATEDIFF(@end_date, @start_date) AS total_days
    FROM DUAL
  ) AS params
  JOIN (
    SELECT a.N + b.N * 10 + c.N * 100 AS seq
    FROM
      (SELECT 0 AS N UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
       UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) a,
      (SELECT 0 AS N UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
       UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) b,
      (SELECT 0 AS N UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
       UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) c
  ) AS nums
  WHERE seq <= total_days
),
features AS (
  -- Daftar transaction category
  SELECT DISTINCT rbb.transaction_category
  FROM raw_bale_bisnis rbb
  WHERE rbb.transaction_date >= @start_date
    AND rbb.transaction_date <  @end_date
),
statuses AS (
  -- Semua transaction_status
  SELECT 0 AS status_code, 'SUCCESS' AS transaction_status UNION ALL
  SELECT 1, 'FAILED'   UNION ALL
  SELECT 2, 'SUSPECT'  UNION ALL
  SELECT 3, 'WAITING'  UNION ALL
  SELECT 4, 'REJECTED'
),
states AS (
  -- Semua transaction_state
  SELECT 0 AS state_code, 'INQUIRY'            AS transaction_state UNION ALL
  SELECT 1, 'EXECUTE'           UNION ALL
  SELECT 2, 'EXECUTE_SCHEDULER' UNION ALL
  SELECT 3, 'INQUIRY_PARTIAL'   UNION ALL
  SELECT 4, 'SCHEDULED'
),
agg AS (
  -- Agregasi per hari Ã— category Ã— status Ã— state Ã— result_code
  SELECT
      DATE(rbb.transaction_date)              AS transaction_date,
      rbb.transaction_category,
      rbb.transaction_status,
      rbb.transaction_state,
      rbb.result_code,
      rbb.result_code_desc,
      COUNT(*)                                AS transaction_count,
      COALESCE(SUM(rbb.transaction_amount),0) AS transaction_amount,
      COALESCE(SUM(rbb.admin_fee),0)          AS total_admin_fee
  FROM raw_bale_bisnis rbb
  WHERE rbb.transaction_date >= @start_date
    AND rbb.transaction_date <  @end_date
  GROUP BY 1,2,3,4,5,6
)
SELECT
    d.transaction_date                    AS `Tanggal Transaksi`,
    f.transaction_category                AS `Jenis Transaksi`,
    s.transaction_status                  AS `Status Transaksi`,
    COALESCE(a.transaction_count, 0)      AS `Total Transaksi`,
    COALESCE(a.transaction_amount, 0)     AS `Total Nominal`,
    COALESCE(a.total_admin_fee, 0)        AS `Total Biaya Admin`,
    COALESCE(a.result_code, '-')          AS `RC`,
    COALESCE(a.result_code_desc, '-')     AS `RC Description`
FROM days d
CROSS JOIN features f
CROSS JOIN statuses s
CROSS JOIN states st
LEFT JOIN agg a
  ON a.transaction_date    = d.transaction_date
 AND a.transaction_category = f.transaction_category
 AND a.transaction_status   = s.status_code
 AND a.transaction_state    = st.state_code
 AND a.transaction_count != 0
ORDER BY
    d.transaction_date,
    f.transaction_category,
    s.transaction_status,
    st.state_code,
    a.result_code IS NULL,
    a.result_code;
