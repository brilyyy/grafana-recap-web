# Community 190: stopScheduler()

**Members:** 5

## Nodes

- **scheduler** (`apps_web_src_lib_scheduler_ts`, File, degree: 4)
- **@/lib/logger/getLogger** (`apps_web_src_lib_scheduler_ts_import_lib_logger_getlogger`, Module, degree: 1)
- **initializeScheduler()** (`apps_web_src_lib_scheduler_ts_initializescheduler`, Function, degree: 2)
- **runStoredProcedure()** (`apps_web_src_lib_scheduler_ts_runstoredprocedure`, Function, degree: 2)
- **stopScheduler()** (`apps_web_src_lib_scheduler_ts_stopscheduler`, Function, degree: 1)

## Relationships

- apps_web_src_lib_scheduler_ts → apps_web_src_lib_scheduler_ts_import_lib_logger_getlogger (imports)
- apps_web_src_lib_scheduler_ts → apps_web_src_lib_scheduler_ts_runstoredprocedure (defines)
- apps_web_src_lib_scheduler_ts → apps_web_src_lib_scheduler_ts_initializescheduler (defines)
- apps_web_src_lib_scheduler_ts → apps_web_src_lib_scheduler_ts_stopscheduler (defines)
- apps_web_src_lib_scheduler_ts_initializescheduler → apps_web_src_lib_scheduler_ts_runstoredprocedure (calls)

