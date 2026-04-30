/**
 * Registry of apps with stored procedures for success rate processing.
 * Add new apps here when procedure.mysql.sql and procedure.postgres.sql exist.
 *
 * @deprecated MySQL — `procedure.mysql.sql` and MySQL procedure paths are deprecated. Use PostgreSQL
 * and `procedure.postgres.sql` only for new work. See scripts/success_rate/README.md.
 */
export type ProcedureApp = {
  appKey: string
  procedureName: string
}

export const PROCEDURE_APPS: ProcedureApp[] = [
  { appKey: 'bale', procedureName: 'sp_process_bale_daily' },
  { appKey: 'bale_bisnis', procedureName: 'sp_process_bale_bisnis_daily' },
  { appKey: 'olob', procedureName: 'sp_process_olob_daily' },
  { appKey: 'edc_agen', procedureName: 'sp_process_edc_agen_daily' },
  { appKey: 'edc_merchant', procedureName: 'sp_process_edc_merchant_daily' },
  { appKey: 'edc_merchant_ancol', procedureName: 'sp_process_edc_merchant_ancol_daily' },
  { appKey: 'cms', procedureName: 'sp_process_cms_daily' },
  { appKey: 'bale_korpora', procedureName: 'sp_process_bale_korpora_daily' },
  { appKey: 'debit_online', procedureName: 'sp_process_debit_online_daily' },
]
