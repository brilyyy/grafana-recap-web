# Community 73: runFdwApply()

**Members:** 13

## Nodes

- **fdw** (`apps_web_src_server_trpc_routers_fdw_ts`, File, degree: 12)
- **createFdwClient()** (`apps_web_src_server_trpc_routers_fdw_ts_createfdwclient`, Function, degree: 2)
- **@/db/db** (`apps_web_src_server_trpc_routers_fdw_ts_import_db_db`, Module, degree: 1)
- **drizzle-orm/sql** (`apps_web_src_server_trpc_routers_fdw_ts_import_drizzle_orm_sql`, Module, degree: 1)
- **@/env/env** (`apps_web_src_server_trpc_routers_fdw_ts_import_env_env`, Module, degree: 1)
- **../init/router** (`apps_web_src_server_trpc_routers_fdw_ts_import_init_router`, Module, degree: 1)
- **../init/superAdminProcedure** (`apps_web_src_server_trpc_routers_fdw_ts_import_init_superadminprocedure`, Module, degree: 1)
- **@/lib/audit/logAuditEvent** (`apps_web_src_server_trpc_routers_fdw_ts_import_lib_audit_logauditevent`, Module, degree: 1)
- **@/lib/fdw-setup/applyFdwConfig** (`apps_web_src_server_trpc_routers_fdw_ts_import_lib_fdw_setup_applyfdwconfig`, Module, degree: 1)
- **postgres/postgres** (`apps_web_src_server_trpc_routers_fdw_ts_import_postgres_postgres`, Module, degree: 1)
- **@trpc/server/TRPCError** (`apps_web_src_server_trpc_routers_fdw_ts_import_trpc_server_trpcerror`, Module, degree: 1)
- **zod/z** (`apps_web_src_server_trpc_routers_fdw_ts_import_zod_z`, Module, degree: 1)
- **runFdwApply()** (`apps_web_src_server_trpc_routers_fdw_ts_runfdwapply`, Function, degree: 2)

## Relationships

- apps_web_src_server_trpc_routers_fdw_ts → apps_web_src_server_trpc_routers_fdw_ts_import_trpc_server_trpcerror (imports)
- apps_web_src_server_trpc_routers_fdw_ts → apps_web_src_server_trpc_routers_fdw_ts_import_drizzle_orm_sql (imports)
- apps_web_src_server_trpc_routers_fdw_ts → apps_web_src_server_trpc_routers_fdw_ts_import_postgres_postgres (imports)
- apps_web_src_server_trpc_routers_fdw_ts → apps_web_src_server_trpc_routers_fdw_ts_import_zod_z (imports)
- apps_web_src_server_trpc_routers_fdw_ts → apps_web_src_server_trpc_routers_fdw_ts_import_db_db (imports)
- apps_web_src_server_trpc_routers_fdw_ts → apps_web_src_server_trpc_routers_fdw_ts_import_env_env (imports)
- apps_web_src_server_trpc_routers_fdw_ts → apps_web_src_server_trpc_routers_fdw_ts_import_lib_audit_logauditevent (imports)
- apps_web_src_server_trpc_routers_fdw_ts → apps_web_src_server_trpc_routers_fdw_ts_import_lib_fdw_setup_applyfdwconfig (imports)
- apps_web_src_server_trpc_routers_fdw_ts → apps_web_src_server_trpc_routers_fdw_ts_import_init_router (imports)
- apps_web_src_server_trpc_routers_fdw_ts → apps_web_src_server_trpc_routers_fdw_ts_import_init_superadminprocedure (imports)
- apps_web_src_server_trpc_routers_fdw_ts → apps_web_src_server_trpc_routers_fdw_ts_createfdwclient (defines)
- apps_web_src_server_trpc_routers_fdw_ts → apps_web_src_server_trpc_routers_fdw_ts_runfdwapply (defines)
- apps_web_src_server_trpc_routers_fdw_ts_runfdwapply → apps_web_src_server_trpc_routers_fdw_ts_createfdwclient (calls)

