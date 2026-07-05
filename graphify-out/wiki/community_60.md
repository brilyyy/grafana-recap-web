# Community 60: _setup_root()

**Members:** 15

## Nodes

- **logging** (`apps_sr_generator_src_lib_logging_py`, File, degree: 11)
- **_ColourFormatter** (`apps_sr_generator_src_lib_logging_py_colourformatter`, Class, degree: 2)
- **.format()** (`apps_sr_generator_src_lib_logging_py_colourformatter_format`, Method, degree: 2)
- **get_logger()** (`apps_sr_generator_src_lib_logging_py_get_logger`, Function, degree: 1)
- **get_pipeline_logger()** (`apps_sr_generator_src_lib_logging_py_get_pipeline_logger`, Function, degree: 2)
- **logging** (`apps_sr_generator_src_lib_logging_py_import_logging`, Module, degree: 1)
- **logging.handlers.RotatingFileHandler** (`apps_sr_generator_src_lib_logging_py_import_logging_handlers_rotatingfilehandler`, Module, degree: 1)
- **pathlib.Path** (`apps_sr_generator_src_lib_logging_py_import_pathlib_path`, Module, degree: 1)
- **pprint** (`apps_sr_generator_src_lib_logging_py_import_pprint`, Module, degree: 1)
- **sys** (`apps_sr_generator_src_lib_logging_py_import_sys`, Module, degree: 1)
- **_PlainFormatter** (`apps_sr_generator_src_lib_logging_py_plainformatter`, Class, degree: 3)
- **.format()** (`apps_sr_generator_src_lib_logging_py_plainformatter_format`, Method, degree: 2)
- **.__init__()** (`apps_sr_generator_src_lib_logging_py_plainformatter_init`, Method, degree: 1)
- **_setup_pipeline_logger()** (`apps_sr_generator_src_lib_logging_py_setup_pipeline_logger`, Function, degree: 2)
- **_setup_root()** (`apps_sr_generator_src_lib_logging_py_setup_root`, Function, degree: 1)

## Relationships

- apps_sr_generator_src_lib_logging_py → apps_sr_generator_src_lib_logging_py_import_logging (imports)
- apps_sr_generator_src_lib_logging_py → apps_sr_generator_src_lib_logging_py_import_pprint (imports)
- apps_sr_generator_src_lib_logging_py → apps_sr_generator_src_lib_logging_py_import_sys (imports)
- apps_sr_generator_src_lib_logging_py → apps_sr_generator_src_lib_logging_py_import_logging_handlers_rotatingfilehandler (imports)
- apps_sr_generator_src_lib_logging_py → apps_sr_generator_src_lib_logging_py_import_pathlib_path (imports)
- apps_sr_generator_src_lib_logging_py → apps_sr_generator_src_lib_logging_py_colourformatter (defines)
- apps_sr_generator_src_lib_logging_py_colourformatter → apps_sr_generator_src_lib_logging_py_colourformatter_format (defines)
- apps_sr_generator_src_lib_logging_py → apps_sr_generator_src_lib_logging_py_plainformatter (defines)
- apps_sr_generator_src_lib_logging_py_plainformatter → apps_sr_generator_src_lib_logging_py_plainformatter_init (defines)
- apps_sr_generator_src_lib_logging_py_plainformatter → apps_sr_generator_src_lib_logging_py_plainformatter_format (defines)
- apps_sr_generator_src_lib_logging_py → apps_sr_generator_src_lib_logging_py_setup_root (defines)
- apps_sr_generator_src_lib_logging_py → apps_sr_generator_src_lib_logging_py_setup_pipeline_logger (defines)
- apps_sr_generator_src_lib_logging_py → apps_sr_generator_src_lib_logging_py_get_logger (defines)
- apps_sr_generator_src_lib_logging_py → apps_sr_generator_src_lib_logging_py_get_pipeline_logger (defines)
- apps_sr_generator_src_lib_logging_py_colourformatter_format → apps_sr_generator_src_lib_logging_py_plainformatter_format (calls)
- apps_sr_generator_src_lib_logging_py_get_pipeline_logger → apps_sr_generator_src_lib_logging_py_setup_pipeline_logger (calls)

