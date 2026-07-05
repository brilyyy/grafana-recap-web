# Community 153: logAuditEvent()

**Members:** 6

## Nodes

- **audit** (`apps_web_src_lib_audit_ts`, File, degree: 5)
- **getClientIp()** (`apps_web_src_lib_audit_ts_getclientip`, Function, degree: 1)
- **getUserAgent()** (`apps_web_src_lib_audit_ts_getuseragent`, Function, degree: 1)
- **@/db/db** (`apps_web_src_lib_audit_ts_import_db_db`, Module, degree: 1)
- **@/db/schema/auditLogs** (`apps_web_src_lib_audit_ts_import_db_schema_auditlogs`, Module, degree: 1)
- **logAuditEvent()** (`apps_web_src_lib_audit_ts_logauditevent`, Function, degree: 1)

## Relationships

- apps_web_src_lib_audit_ts → apps_web_src_lib_audit_ts_import_db_db (imports)
- apps_web_src_lib_audit_ts → apps_web_src_lib_audit_ts_import_db_schema_auditlogs (imports)
- apps_web_src_lib_audit_ts → apps_web_src_lib_audit_ts_logauditevent (defines)
- apps_web_src_lib_audit_ts → apps_web_src_lib_audit_ts_getclientip (defines)
- apps_web_src_lib_audit_ts → apps_web_src_lib_audit_ts_getuseragent (defines)

