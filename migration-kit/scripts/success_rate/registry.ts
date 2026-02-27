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
]
