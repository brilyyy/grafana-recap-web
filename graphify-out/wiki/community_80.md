# Community 80: stripComments()

**Members:** 12

## Nodes

- **sql-loader** (`apps_web_src_db_sql_loader_ts`, File, degree: 11)
- **extractFunctionName()** (`apps_web_src_db_sql_loader_ts_extractfunctionname`, Function, degree: 2)
- **node:fs** (`apps_web_src_db_sql_loader_ts_import_node_fs`, Module, degree: 1)
- **node:path** (`apps_web_src_db_sql_loader_ts_import_node_path`, Module, degree: 1)
- **listSqlFiles()** (`apps_web_src_db_sql_loader_ts_listsqlfiles`, Function, degree: 5)
- **loadPhaseStatements()** (`apps_web_src_db_sql_loader_ts_loadphasestatements`, Function, degree: 3)
- **loadProcedureFiles()** (`apps_web_src_db_sql_loader_ts_loadprocedurefiles`, Function, degree: 2)
- **loadProcedureMetas()** (`apps_web_src_db_sql_loader_ts_loadproceduremetas`, Function, degree: 4)
- **parseSqlMeta()** (`apps_web_src_db_sql_loader_ts_parsesqlmeta`, Function, degree: 2)
- **scanSqlObjects()** (`apps_web_src_db_sql_loader_ts_scansqlobjects`, Function, degree: 3)
- **splitSqlStatements()** (`apps_web_src_db_sql_loader_ts_splitsqlstatements`, Function, degree: 2)
- **stripComments()** (`apps_web_src_db_sql_loader_ts_stripcomments`, Function, degree: 2)

## Relationships

- apps_web_src_db_sql_loader_ts → apps_web_src_db_sql_loader_ts_import_node_fs (imports)
- apps_web_src_db_sql_loader_ts → apps_web_src_db_sql_loader_ts_import_node_path (imports)
- apps_web_src_db_sql_loader_ts → apps_web_src_db_sql_loader_ts_splitsqlstatements (defines)
- apps_web_src_db_sql_loader_ts → apps_web_src_db_sql_loader_ts_listsqlfiles (defines)
- apps_web_src_db_sql_loader_ts → apps_web_src_db_sql_loader_ts_loadphasestatements (defines)
- apps_web_src_db_sql_loader_ts → apps_web_src_db_sql_loader_ts_loadprocedurefiles (defines)
- apps_web_src_db_sql_loader_ts → apps_web_src_db_sql_loader_ts_parsesqlmeta (defines)
- apps_web_src_db_sql_loader_ts → apps_web_src_db_sql_loader_ts_extractfunctionname (defines)
- apps_web_src_db_sql_loader_ts → apps_web_src_db_sql_loader_ts_loadproceduremetas (defines)
- apps_web_src_db_sql_loader_ts → apps_web_src_db_sql_loader_ts_stripcomments (defines)
- apps_web_src_db_sql_loader_ts → apps_web_src_db_sql_loader_ts_scansqlobjects (defines)
- apps_web_src_db_sql_loader_ts_loadphasestatements → apps_web_src_db_sql_loader_ts_listsqlfiles (calls)
- apps_web_src_db_sql_loader_ts_loadphasestatements → apps_web_src_db_sql_loader_ts_splitsqlstatements (calls)
- apps_web_src_db_sql_loader_ts_loadprocedurefiles → apps_web_src_db_sql_loader_ts_listsqlfiles (calls)
- apps_web_src_db_sql_loader_ts_loadproceduremetas → apps_web_src_db_sql_loader_ts_listsqlfiles (calls)
- apps_web_src_db_sql_loader_ts_loadproceduremetas → apps_web_src_db_sql_loader_ts_extractfunctionname (calls)
- apps_web_src_db_sql_loader_ts_loadproceduremetas → apps_web_src_db_sql_loader_ts_parsesqlmeta (calls)
- apps_web_src_db_sql_loader_ts_scansqlobjects → apps_web_src_db_sql_loader_ts_listsqlfiles (calls)
- apps_web_src_db_sql_loader_ts_scansqlobjects → apps_web_src_db_sql_loader_ts_stripcomments (calls)

