# Community 111: _row_to_dict()

**Members:** 8

## Nodes

- **mapping_db** (`apps_sr_generator_src_services_mapping_db_py`, File, degree: 7)
- **fetch_all_mappings()** (`apps_sr_generator_src_services_mapping_db_py_fetch_all_mappings`, Function, degree: 2)
- **fetch_mapping()** (`apps_sr_generator_src_services_mapping_db_py_fetch_mapping`, Function, degree: 2)
- **json** (`apps_sr_generator_src_services_mapping_db_py_import_json`, Module, degree: 1)
- **lib.db.postgres._connect** (`apps_sr_generator_src_services_mapping_db_py_import_lib_db_postgres_connect`, Module, degree: 1)
- **lib.settings.DatabaseSettings** (`apps_sr_generator_src_services_mapping_db_py_import_lib_settings_databasesettings`, Module, degree: 1)
- **typing.Any** (`apps_sr_generator_src_services_mapping_db_py_import_typing_any`, Module, degree: 1)
- **_row_to_dict()** (`apps_sr_generator_src_services_mapping_db_py_row_to_dict`, Function, degree: 3)

## Relationships

- apps_sr_generator_src_services_mapping_db_py → apps_sr_generator_src_services_mapping_db_py_import_json (imports)
- apps_sr_generator_src_services_mapping_db_py → apps_sr_generator_src_services_mapping_db_py_import_typing_any (imports)
- apps_sr_generator_src_services_mapping_db_py → apps_sr_generator_src_services_mapping_db_py_import_lib_db_postgres_connect (imports)
- apps_sr_generator_src_services_mapping_db_py → apps_sr_generator_src_services_mapping_db_py_import_lib_settings_databasesettings (imports)
- apps_sr_generator_src_services_mapping_db_py → apps_sr_generator_src_services_mapping_db_py_fetch_mapping (defines)
- apps_sr_generator_src_services_mapping_db_py → apps_sr_generator_src_services_mapping_db_py_fetch_all_mappings (defines)
- apps_sr_generator_src_services_mapping_db_py → apps_sr_generator_src_services_mapping_db_py_row_to_dict (defines)
- apps_sr_generator_src_services_mapping_db_py_fetch_mapping → apps_sr_generator_src_services_mapping_db_py_row_to_dict (calls)
- apps_sr_generator_src_services_mapping_db_py_fetch_all_mappings → apps_sr_generator_src_services_mapping_db_py_row_to_dict (calls)

