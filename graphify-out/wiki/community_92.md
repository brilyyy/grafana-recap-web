# Community 92: reset_database_settings_cache()

**Members:** 10

## Nodes

- **settings** (`apps_sr_generator_src_lib_settings_py`, File, degree: 7)
- **DatabaseSettings** (`apps_sr_generator_src_lib_settings_py_databasesettings`, Class, degree: 3)
- **.from_env()** (`apps_sr_generator_src_lib_settings_py_databasesettings_from_env`, Method, degree: 3)
- **.is_configured()** (`apps_sr_generator_src_lib_settings_py_databasesettings_is_configured`, Method, degree: 1)
- **get_database_settings()** (`apps_sr_generator_src_lib_settings_py_get_database_settings`, Function, degree: 2)
- **dataclasses.dataclass** (`apps_sr_generator_src_lib_settings_py_import_dataclasses_dataclass`, Module, degree: 1)
- **os** (`apps_sr_generator_src_lib_settings_py_import_os`, Module, degree: 1)
- **re** (`apps_sr_generator_src_lib_settings_py_import_re`, Module, degree: 1)
- **_require_sql_ident()** (`apps_sr_generator_src_lib_settings_py_require_sql_ident`, Function, degree: 2)
- **reset_database_settings_cache()** (`apps_sr_generator_src_lib_settings_py_reset_database_settings_cache`, Function, degree: 1)

## Relationships

- apps_sr_generator_src_lib_settings_py → apps_sr_generator_src_lib_settings_py_import_os (imports)
- apps_sr_generator_src_lib_settings_py → apps_sr_generator_src_lib_settings_py_import_re (imports)
- apps_sr_generator_src_lib_settings_py → apps_sr_generator_src_lib_settings_py_import_dataclasses_dataclass (imports)
- apps_sr_generator_src_lib_settings_py → apps_sr_generator_src_lib_settings_py_require_sql_ident (defines)
- apps_sr_generator_src_lib_settings_py → apps_sr_generator_src_lib_settings_py_databasesettings (defines)
- apps_sr_generator_src_lib_settings_py_databasesettings → apps_sr_generator_src_lib_settings_py_databasesettings_is_configured (defines)
- apps_sr_generator_src_lib_settings_py_databasesettings → apps_sr_generator_src_lib_settings_py_databasesettings_from_env (defines)
- apps_sr_generator_src_lib_settings_py → apps_sr_generator_src_lib_settings_py_get_database_settings (defines)
- apps_sr_generator_src_lib_settings_py → apps_sr_generator_src_lib_settings_py_reset_database_settings_cache (defines)
- apps_sr_generator_src_lib_settings_py_databasesettings_from_env → apps_sr_generator_src_lib_settings_py_require_sql_ident (calls)
- apps_sr_generator_src_lib_settings_py_get_database_settings → apps_sr_generator_src_lib_settings_py_databasesettings_from_env (calls)

