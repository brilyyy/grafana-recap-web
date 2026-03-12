/**
 * Registry of apps with stored procedures for success rate processing.
 * Add new apps here when procedure.mysql.sql and procedure.postgres.sql exist.
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
]
