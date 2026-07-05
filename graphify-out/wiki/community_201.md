# Community 201: _text()

**Members:** 5

## Nodes

- **_effective_run_id_raw()** (`apps_sr_generator_src_lib_data_processing_synthetic_py_effective_run_id_raw`, Function, degree: 2)
- **_parse_optional_ms()** (`apps_sr_generator_src_lib_data_processing_synthetic_py_parse_optional_ms`, Function, degree: 3)
- **_parse_required_ms()** (`apps_sr_generator_src_lib_data_processing_synthetic_py_parse_required_ms`, Function, degree: 3)
- **_row_to_record()** (`apps_sr_generator_src_lib_data_processing_synthetic_py_row_to_record`, Function, degree: 9)
- **_text()** (`apps_sr_generator_src_lib_data_processing_synthetic_py_text`, Function, degree: 2)

## Relationships

- apps_sr_generator_src_lib_data_processing_synthetic_py_parse_required_ms → apps_sr_generator_src_lib_data_processing_synthetic_py_parse_optional_ms (calls)
- apps_sr_generator_src_lib_data_processing_synthetic_py_row_to_record → apps_sr_generator_src_lib_data_processing_synthetic_py_effective_run_id_raw (calls)
- apps_sr_generator_src_lib_data_processing_synthetic_py_row_to_record → apps_sr_generator_src_lib_data_processing_synthetic_py_parse_required_ms (calls)
- apps_sr_generator_src_lib_data_processing_synthetic_py_row_to_record → apps_sr_generator_src_lib_data_processing_synthetic_py_parse_optional_ms (calls)
- apps_sr_generator_src_lib_data_processing_synthetic_py_row_to_record → apps_sr_generator_src_lib_data_processing_synthetic_py_text (calls)

