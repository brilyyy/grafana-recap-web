# Community 63: validatePastDate()

**Members:** 15

## Nodes

- **trigger-recap** (`apps_web_src_lib_application_recap_trigger_recap_ts`, File, degree: 13)
- **@/db/db** (`apps_web_src_lib_application_recap_trigger_recap_ts_import_db_db`, Module, degree: 1)
- **drizzle-orm/sql** (`apps_web_src_lib_application_recap_trigger_recap_ts_import_drizzle_orm_sql`, Module, degree: 1)
- **@/lib/domain/recap/catalog/catalogEntryToLogFilter** (`apps_web_src_lib_application_recap_trigger_recap_ts_import_lib_domain_recap_catalog_catalogentrytologfilter`, Module, degree: 1)
- **@/lib/domain/recap/catalog/getCatalogEntryByIdAsync** (`apps_web_src_lib_application_recap_trigger_recap_ts_import_lib_domain_recap_catalog_getcatalogentrybyidasync`, Module, degree: 1)
- **@/lib/domain/recap/resolve-app/normalizeAppNameToKey** (`apps_web_src_lib_application_recap_trigger_recap_ts_import_lib_domain_recap_resolve_app_normalizeappnametokey`, Module, degree: 1)
- **@/lib/domain/recap/types/TriggerRecapParams** (`apps_web_src_lib_application_recap_trigger_recap_ts_import_lib_domain_recap_types_triggerrecapparams`, Module, degree: 1)
- **@/lib/domain/recap/types/TriggerRecapResult** (`apps_web_src_lib_application_recap_trigger_recap_ts_import_lib_domain_recap_types_triggerrecapresult`, Module, degree: 1)
- **@/lib/logger/getLogger** (`apps_web_src_lib_application_recap_trigger_recap_ts_import_lib_logger_getlogger`, Module, degree: 1)
- **RecapValidationError** (`apps_web_src_lib_application_recap_trigger_recap_ts_recapvalidationerror`, Class, degree: 2)
- **.constructor()** (`apps_web_src_lib_application_recap_trigger_recap_ts_recapvalidationerror_constructor`, Method, degree: 1)
- **resolveAppForEntry()** (`apps_web_src_lib_application_recap_trigger_recap_ts_resolveappforentry`, Function, degree: 2)
- **resolveTargetDate()** (`apps_web_src_lib_application_recap_trigger_recap_ts_resolvetargetdate`, Function, degree: 2)
- **triggerRecap()** (`apps_web_src_lib_application_recap_trigger_recap_ts_triggerrecap`, Function, degree: 4)
- **validatePastDate()** (`apps_web_src_lib_application_recap_trigger_recap_ts_validatepastdate`, Function, degree: 2)

## Relationships

- apps_web_src_lib_application_recap_trigger_recap_ts → apps_web_src_lib_application_recap_trigger_recap_ts_import_drizzle_orm_sql (imports)
- apps_web_src_lib_application_recap_trigger_recap_ts → apps_web_src_lib_application_recap_trigger_recap_ts_import_db_db (imports)
- apps_web_src_lib_application_recap_trigger_recap_ts → apps_web_src_lib_application_recap_trigger_recap_ts_import_lib_domain_recap_catalog_catalogentrytologfilter (imports)
- apps_web_src_lib_application_recap_trigger_recap_ts → apps_web_src_lib_application_recap_trigger_recap_ts_import_lib_domain_recap_catalog_getcatalogentrybyidasync (imports)
- apps_web_src_lib_application_recap_trigger_recap_ts → apps_web_src_lib_application_recap_trigger_recap_ts_import_lib_domain_recap_resolve_app_normalizeappnametokey (imports)
- apps_web_src_lib_application_recap_trigger_recap_ts → apps_web_src_lib_application_recap_trigger_recap_ts_import_lib_domain_recap_types_triggerrecapparams (imports)
- apps_web_src_lib_application_recap_trigger_recap_ts → apps_web_src_lib_application_recap_trigger_recap_ts_import_lib_domain_recap_types_triggerrecapresult (imports)
- apps_web_src_lib_application_recap_trigger_recap_ts → apps_web_src_lib_application_recap_trigger_recap_ts_import_lib_logger_getlogger (imports)
- apps_web_src_lib_application_recap_trigger_recap_ts → apps_web_src_lib_application_recap_trigger_recap_ts_recapvalidationerror (defines)
- apps_web_src_lib_application_recap_trigger_recap_ts_recapvalidationerror → apps_web_src_lib_application_recap_trigger_recap_ts_recapvalidationerror_constructor (defines)
- apps_web_src_lib_application_recap_trigger_recap_ts → apps_web_src_lib_application_recap_trigger_recap_ts_resolvetargetdate (defines)
- apps_web_src_lib_application_recap_trigger_recap_ts → apps_web_src_lib_application_recap_trigger_recap_ts_validatepastdate (defines)
- apps_web_src_lib_application_recap_trigger_recap_ts → apps_web_src_lib_application_recap_trigger_recap_ts_resolveappforentry (defines)
- apps_web_src_lib_application_recap_trigger_recap_ts → apps_web_src_lib_application_recap_trigger_recap_ts_triggerrecap (defines)
- apps_web_src_lib_application_recap_trigger_recap_ts_triggerrecap → apps_web_src_lib_application_recap_trigger_recap_ts_validatepastdate (calls)
- apps_web_src_lib_application_recap_trigger_recap_ts_triggerrecap → apps_web_src_lib_application_recap_trigger_recap_ts_resolveappforentry (calls)
- apps_web_src_lib_application_recap_trigger_recap_ts_triggerrecap → apps_web_src_lib_application_recap_trigger_recap_ts_resolvetargetdate (calls)

