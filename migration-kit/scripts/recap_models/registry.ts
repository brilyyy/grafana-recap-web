/**
 * Custom daily recap models (not app_success_rate). Each entry has a folder under
 * scripts/recap_models/{modelKey}/ with procedure.postgres.sql and raw.postgres.sql.
 */
export type RecapModelEntry = {
  modelKey: string
  functionName: string
  scheduleEnvVar: string
}

export const RECAP_MODEL_REGISTRY: RecapModelEntry[] = [
  {
    modelKey: 'cms_corp_daily',
    functionName: 'sp_recap_cms_corp_daily',
    scheduleEnvVar: 'CMS_CORP_RECAP_SCHEDULE',
  },
]
