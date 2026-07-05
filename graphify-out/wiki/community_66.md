# Community 66: updateJobStatus()

**Members:** 14

## Nodes

- **scheduler-worker** (`apps_web_src_workers_scheduler_worker_ts`, File, degree: 13)
- **../db/schema/scheduler/schedulerJobs** (`apps_web_src_workers_scheduler_worker_ts_import_db_schema_scheduler_schedulerjobs`, Module, degree: 1)
- **drizzle-orm/eq** (`apps_web_src_workers_scheduler_worker_ts_import_drizzle_orm_eq`, Module, degree: 1)
- **drizzle-orm/postgres-js/drizzle** (`apps_web_src_workers_scheduler_worker_ts_import_drizzle_orm_postgres_js_drizzle`, Module, degree: 1)
- **../lib/logger/createFileLogger** (`apps_web_src_workers_scheduler_worker_ts_import_lib_logger_createfilelogger`, Module, degree: 1)
- **postgres/postgres** (`apps_web_src_workers_scheduler_worker_ts_import_postgres_postgres`, Module, degree: 1)
- **loadJobs()** (`apps_web_src_workers_scheduler_worker_ts_loadjobs`, Function, degree: 2)
- **logJobSummary()** (`apps_web_src_workers_scheduler_worker_ts_logjobsummary`, Function, degree: 2)
- **refreshJobs()** (`apps_web_src_workers_scheduler_worker_ts_refreshjobs`, Function, degree: 2)
- **restart()** (`apps_web_src_workers_scheduler_worker_ts_restart`, Function, degree: 4)
- **runProcedure()** (`apps_web_src_workers_scheduler_worker_ts_runprocedure`, Function, degree: 2)
- **startAll()** (`apps_web_src_workers_scheduler_worker_ts_startall`, Function, degree: 6)
- **stopAll()** (`apps_web_src_workers_scheduler_worker_ts_stopall`, Function, degree: 2)
- **updateJobStatus()** (`apps_web_src_workers_scheduler_worker_ts_updatejobstatus`, Function, degree: 2)

## Relationships

- apps_web_src_workers_scheduler_worker_ts → apps_web_src_workers_scheduler_worker_ts_import_drizzle_orm_eq (imports)
- apps_web_src_workers_scheduler_worker_ts → apps_web_src_workers_scheduler_worker_ts_import_drizzle_orm_postgres_js_drizzle (imports)
- apps_web_src_workers_scheduler_worker_ts → apps_web_src_workers_scheduler_worker_ts_import_postgres_postgres (imports)
- apps_web_src_workers_scheduler_worker_ts → apps_web_src_workers_scheduler_worker_ts_import_db_schema_scheduler_schedulerjobs (imports)
- apps_web_src_workers_scheduler_worker_ts → apps_web_src_workers_scheduler_worker_ts_import_lib_logger_createfilelogger (imports)
- apps_web_src_workers_scheduler_worker_ts → apps_web_src_workers_scheduler_worker_ts_logjobsummary (defines)
- apps_web_src_workers_scheduler_worker_ts → apps_web_src_workers_scheduler_worker_ts_loadjobs (defines)
- apps_web_src_workers_scheduler_worker_ts → apps_web_src_workers_scheduler_worker_ts_runprocedure (defines)
- apps_web_src_workers_scheduler_worker_ts → apps_web_src_workers_scheduler_worker_ts_updatejobstatus (defines)
- apps_web_src_workers_scheduler_worker_ts → apps_web_src_workers_scheduler_worker_ts_refreshjobs (defines)
- apps_web_src_workers_scheduler_worker_ts → apps_web_src_workers_scheduler_worker_ts_startall (defines)
- apps_web_src_workers_scheduler_worker_ts → apps_web_src_workers_scheduler_worker_ts_stopall (defines)
- apps_web_src_workers_scheduler_worker_ts → apps_web_src_workers_scheduler_worker_ts_restart (defines)
- apps_web_src_workers_scheduler_worker_ts_startall → apps_web_src_workers_scheduler_worker_ts_updatejobstatus (calls)
- apps_web_src_workers_scheduler_worker_ts_startall → apps_web_src_workers_scheduler_worker_ts_runprocedure (calls)
- apps_web_src_workers_scheduler_worker_ts_startall → apps_web_src_workers_scheduler_worker_ts_refreshjobs (calls)
- apps_web_src_workers_scheduler_worker_ts_startall → apps_web_src_workers_scheduler_worker_ts_logjobsummary (calls)
- apps_web_src_workers_scheduler_worker_ts_restart → apps_web_src_workers_scheduler_worker_ts_stopall (calls)
- apps_web_src_workers_scheduler_worker_ts_restart → apps_web_src_workers_scheduler_worker_ts_loadjobs (calls)
- apps_web_src_workers_scheduler_worker_ts_restart → apps_web_src_workers_scheduler_worker_ts_startall (calls)

