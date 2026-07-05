# 📊 Graph Analysis Report

**Root:** `.`

## Summary

| Metric | Value |
|--------|-------|
| Nodes | 3014 |
| Edges | 3054 |
| Communities | 245 |
| Hyperedges | 0 |

### Confidence Breakdown

| Level | Count | Percentage |
|-------|-------|------------|
| EXTRACTED | 2794 | 91.5% |
| INFERRED | 260 | 8.5% |
| AMBIGUOUS | 0 | 0.0% |

## 🌟 God Nodes (Most Connected)

| Node | Degree | Community |
|------|--------|-----------|
| jobs | 79 | 0 |
| application.$appId | 68 | 1 |
| housekeeping | 58 | 2 |
| generator | 55 | 3 |
| users | 54 | 4 |
| dictionary-card | 52 | 5 |
| no-rc-transaction-card | 47 | 7 |
| api | 47 | 6 |
| unmapped-rc-card | 45 | 9 |
| databases | 45 | 8 |

## 🔮 Surprising Connections

- **apps_web_src_lib_domain_recap_catalog_ts_getallcatalogentries** → **apps_web_src_lib_domain_recap_catalog_ts_buildrecapcatalog** (calls)
- **apps_web_src_db_schema_engine_ts_diagnose** → **apps_web_src_db_schema_engine_ts_bind** (calls)
- **apps_sr_generator_src_lib_data_processing_synthetic_py_row_to_record** → **apps_sr_generator_src_lib_data_processing_synthetic_py_parse_datetime** (calls)
- **apps_sr_generator_src_lib_data_processing_synthetic_py_row_to_record** → **apps_sr_generator_src_lib_data_processing_synthetic_py_parse_trx_date** (calls)
- **apps_sr_generator_src_lib_data_processing_synthetic_py_read_synthetic_xlsx** → **apps_sr_generator_src_lib_data_processing_synthetic_py_row_to_record** (calls)

## 🏘️ Communities

### Community 0 — toggleDate() (80 nodes, cohesion: 0.03)

- jobs
- handleDateProcessing()
- @/components/cron-description/CronDescription
- @/components/ui/badge/Badge
- @/components/ui/button/Button
- @/components/ui/card/Card
- @/components/ui/card/CardContent
- @/components/ui/card/CardDescription
- @/components/ui/card/CardHeader
- @/components/ui/card/CardTitle
- @/components/ui/checkbox/Checkbox
- @/components/ui/command/Command
- @/components/ui/command/CommandEmpty
- @/components/ui/command/CommandGroup
- @/components/ui/command/CommandInput
- @/components/ui/command/CommandItem
- @/components/ui/command/CommandList
- @/components/ui/empty/Empty
- @/components/ui/empty/EmptyDescription
- @/components/ui/empty/EmptyHeader
- _…and 60 more_

### Community 1 — handleImport() (69 nodes, cohesion: 0.03)

- application.$appId
- buildSqlTemplate()
- handleFormatSql()
- handleImport()
- @/components/cron-description/CronDescription
- @/components/ui/badge/Badge
- @/components/ui/button/Button
- @/components/ui/card/Card
- @/components/ui/card/CardContent
- @/components/ui/card/CardDescription
- @/components/ui/card/CardHeader
- @/components/ui/card/CardTitle
- @/components/ui/command/Command
- @/components/ui/command/CommandEmpty
- @/components/ui/command/CommandGroup
- @/components/ui/command/CommandInput
- @/components/ui/command/CommandItem
- @/components/ui/command/CommandList
- @/components/ui/dialog/Dialog
- @/components/ui/dialog/DialogContent
- _…and 49 more_

### Community 2 — onAddRow() (59 nodes, cohesion: 0.03)

- housekeeping
- handleRun()
- @/components/ui/alert/Alert
- @/components/ui/alert/AlertDescription
- @/components/ui/alert/AlertTitle
- @/components/ui/badge/Badge
- @/components/ui/button/Button
- @/components/ui/card/Card
- @/components/ui/card/CardContent
- @/components/ui/card/CardDescription
- @/components/ui/card/CardHeader
- @/components/ui/card/CardTitle
- @/components/ui/dialog/Dialog
- @/components/ui/dialog/DialogContent
- @/components/ui/dialog/DialogDescription
- @/components/ui/dialog/DialogFooter
- @/components/ui/dialog/DialogHeader
- @/components/ui/dialog/DialogTitle
- @/components/ui/empty/Empty
- @/components/ui/empty/EmptyDescription
- _…and 39 more_

### Community 3 — yearDateRange() (56 nodes, cohesion: 0.04)

- generator
- addToList()
- DownloadButton()
- formatSize()
- handleGenerateDb()
- handleGenerateExcel()
- handleSaveMapping()
- @/components/ui/badge/Badge
- @/components/ui/button/Button
- @/components/ui/card/Card
- @/components/ui/card/CardContent
- @/components/ui/card/CardDescription
- @/components/ui/card/CardHeader
- @/components/ui/card/CardTitle
- @/components/ui/dialog/Dialog
- @/components/ui/dialog/DialogContent
- @/components/ui/dialog/DialogDescription
- @/components/ui/dialog/DialogFooter
- @/components/ui/dialog/DialogHeader
- @/components/ui/dialog/DialogTitle
- _…and 36 more_

### Community 4 — toggleSort() (4) (55 nodes, cohesion: 0.04)

- users
- closeRequestDialog()
- handleApprove()
- handleReject()
- handleUpdateRole()
- @/components/ui/button/Button
- @/components/ui/card/Card
- @/components/ui/card/CardContent
- @/components/ui/card/CardDescription
- @/components/ui/card/CardHeader
- @/components/ui/card/CardTitle
- @/components/ui/dialog/Dialog
- @/components/ui/dialog/DialogContent
- @/components/ui/dialog/DialogDescription
- @/components/ui/dialog/DialogFooter
- @/components/ui/dialog/DialogHeader
- @/components/ui/dialog/DialogTitle
- @/components/ui/empty/Empty
- @/components/ui/empty/EmptyDescription
- @/components/ui/empty/EmptyHeader
- _…and 35 more_

### Community 5 — toggleSort() (5) (53 nodes, cohesion: 0.04)

- dictionary-card
- ErrorTypeBadge()
- exportToCSV()
- handleBulkUpdateDescription()
- handleUpdateDescription()
- handleUpdateErrorType()
- @/components/table-pager/TablePager
- @/components/ui/alert/Alert
- @/components/ui/alert/AlertDescription
- @/components/ui/alert/AlertTitle
- @/components/ui/badge/Badge
- @/components/ui/button/Button
- @/components/ui/card/Card
- @/components/ui/card/CardContent
- @/components/ui/checkbox/Checkbox
- @/components/ui/empty/Empty
- @/components/ui/empty/EmptyDescription
- @/components/ui/empty/EmptyHeader
- @/components/ui/empty/EmptyMedia
- @/components/ui/empty/EmptyTitle
- _…and 33 more_

### Community 6 — _verify_api_key() (48 nodes, cohesion: 0.04)

- api
- DbApp
- delete_report()
- download_report()
- generate_db()
- generate_excel()
- generate_synthetic()
- GenerateDbRequest
- GenerateResponse
- health()
- HealthResponse
- constants.DATA_DIR
- datetime.date
- dotenv.load_dotenv
- fastapi.Depends
- fastapi.FastAPI
- fastapi.File
- fastapi.Form
- fastapi.Header
- fastapi.HTTPException
- _…and 28 more_

### Community 7 — toggleSort() (48 nodes, cohesion: 0.04)

- no-rc-transaction-card
- afterSubmit()
- handleSubmit()
- handleSubmitAll()
- @/components/table-pager/TablePager
- @/components/ui/alert/Alert
- @/components/ui/alert/AlertDescription
- @/components/ui/alert/AlertTitle
- @/components/ui/button/Button
- @/components/ui/card/Card
- @/components/ui/card/CardContent
- @/components/ui/checkbox/Checkbox
- @/components/ui/empty/Empty
- @/components/ui/empty/EmptyDescription
- @/components/ui/empty/EmptyHeader
- @/components/ui/empty/EmptyMedia
- @/components/ui/empty/EmptyTitle
- @/components/ui/input/Input
- @/components/ui/select/Select
- @/components/ui/select/SelectContent
- _…and 28 more_

### Community 8 — zod/z (8) (46 nodes, cohesion: 0.04)

- databases
- @/components/ui/badge/Badge
- @/components/ui/button/Button
- @/components/ui/card/Card
- @/components/ui/card/CardContent
- @/components/ui/card/CardDescription
- @/components/ui/card/CardHeader
- @/components/ui/card/CardTitle
- @/components/ui/dialog/Dialog
- @/components/ui/dialog/DialogContent
- @/components/ui/dialog/DialogDescription
- @/components/ui/dialog/DialogHeader
- @/components/ui/dialog/DialogTitle
- @/components/ui/empty/Empty
- @/components/ui/empty/EmptyDescription
- @/components/ui/empty/EmptyHeader
- @/components/ui/empty/EmptyMedia
- @/components/ui/empty/EmptyTitle
- @/components/ui/form/Form
- @/components/ui/form/FormControl
- _…and 26 more_

### Community 9 — toggleSort() (9) (46 nodes, cohesion: 0.05)

- unmapped-rc-card
- afterSubmit()
- handleErrorTypeChange()
- handleSubmit()
- handleSubmitAll()
- @/components/table-pager/TablePager
- @/components/ui/alert/Alert
- @/components/ui/alert/AlertDescription
- @/components/ui/alert/AlertTitle
- @/components/ui/badge/Badge
- @/components/ui/button/Button
- @/components/ui/card/Card
- @/components/ui/card/CardContent
- @/components/ui/checkbox/Checkbox
- @/components/ui/empty/Empty
- @/components/ui/empty/EmptyDescription
- @/components/ui/empty/EmptyHeader
- @/components/ui/empty/EmptyMedia
- @/components/ui/empty/EmptyTitle
- @/components/ui/select/Select
- _…and 26 more_

### Community 10 — toggleSort() (10) (39 nodes, cohesion: 0.05)

- audit-logs
- @/components/ui/badge/Badge
- @/components/ui/button/Button
- @/components/ui/card/Card
- @/components/ui/card/CardContent
- @/components/ui/card/CardDescription
- @/components/ui/card/CardHeader
- @/components/ui/card/CardTitle
- @/components/ui/empty/Empty
- @/components/ui/empty/EmptyDescription
- @/components/ui/empty/EmptyHeader
- @/components/ui/empty/EmptyMedia
- @/components/ui/empty/EmptyTitle
- @/components/ui/input/Input
- @/components/ui/label/Label
- @/components/ui/skeleton/Skeleton
- @/components/ui/table/Table
- @/components/ui/table/TableBody
- @/components/ui/table/TableCell
- @/components/ui/table/TableHead
- _…and 19 more_

### Community 11 — StatusBadge() (11) (35 nodes, cohesion: 0.06)

- app-setup-panel
- getCategoryLabel()
- getPhases()
- @/components/ui/badge/Badge
- @/components/ui/button/Button
- @/components/ui/card/Card
- @/components/ui/card/CardContent
- @/components/ui/card/CardDescription
- @/components/ui/card/CardHeader
- @/components/ui/card/CardTitle
- @/components/ui/dialog/Dialog
- @/components/ui/dialog/DialogContent
- @/components/ui/dialog/DialogDescription
- @/components/ui/dialog/DialogFooter
- @/components/ui/dialog/DialogHeader
- @/components/ui/dialog/DialogTitle
- @/components/ui/label/Label
- @/components/ui/radio-group/RadioGroup
- @/components/ui/radio-group/RadioGroupItem
- @/components/ui/scroll-area/ScrollArea
- _…and 15 more_

### Community 12 — onSubmit() (12) (35 nodes, cohesion: 0.06)

- register
- @/components/auth-layout/AuthLayout
- @/components/ui/alert/Alert
- @/components/ui/alert/AlertDescription
- @/components/ui/button/Button
- @/components/ui/card/Card
- @/components/ui/card/CardContent
- @/components/ui/card/CardDescription
- @/components/ui/card/CardFooter
- @/components/ui/card/CardHeader
- @/components/ui/card/CardTitle
- @/components/ui/form/Form
- @/components/ui/form/FormControl
- @/components/ui/form/FormField
- @/components/ui/form/FormItem
- @/components/ui/form/FormLabel
- @/components/ui/form/FormMessage
- @/components/ui/input/Input
- @/components/ui/skeleton/Skeleton
- @hookform/resolvers/zod/zodResolver
- _…and 15 more_

### Community 13 — StatusBadge() (13) (35 nodes, cohesion: 0.06)

- app-setup-panel
- getCategoryLabel()
- getPhases()
- @/components/ui/badge/Badge
- @/components/ui/button/Button
- @/components/ui/card/Card
- @/components/ui/card/CardContent
- @/components/ui/card/CardDescription
- @/components/ui/card/CardHeader
- @/components/ui/card/CardTitle
- @/components/ui/dialog/Dialog
- @/components/ui/dialog/DialogContent
- @/components/ui/dialog/DialogDescription
- @/components/ui/dialog/DialogFooter
- @/components/ui/dialog/DialogHeader
- @/components/ui/dialog/DialogTitle
- @/components/ui/label/Label
- @/components/ui/radio-group/RadioGroup
- @/components/ui/radio-group/RadioGroupItem
- @/components/ui/scroll-area/ScrollArea
- _…and 15 more_

### Community 14 — onSubmit() (14) (32 nodes, cohesion: 0.06)

- login
- @/components/auth-layout/AuthLayout
- @/components/ui/alert/Alert
- @/components/ui/alert/AlertDescription
- @/components/ui/button/Button
- @/components/ui/card/Card
- @/components/ui/card/CardContent
- @/components/ui/card/CardDescription
- @/components/ui/card/CardFooter
- @/components/ui/card/CardHeader
- @/components/ui/card/CardTitle
- @/components/ui/form/Form
- @/components/ui/form/FormControl
- @/components/ui/form/FormField
- @/components/ui/form/FormItem
- @/components/ui/form/FormLabel
- @/components/ui/form/FormMessage
- @/components/ui/input/Input
- @hookform/resolvers/zod/zodResolver
- @/lib/auth-client/authClient
- _…and 12 more_

### Community 15 — onSubmit() (32 nodes, cohesion: 0.06)

- add-success-rate-card
- @/components/file-dropzone/FileDropzone
- @/components/skipped-rows-dialog/SkippedRow
- @/components/skipped-rows-dialog/SkippedRowsDialog
- @/components/ui/button/Button
- @/components/ui/card/Card
- @/components/ui/card/CardContent
- @/components/ui/card/CardDescription
- @/components/ui/card/CardHeader
- @/components/ui/card/CardTitle
- @/components/ui/form/Form
- @/components/ui/form/FormControl
- @/components/ui/form/FormField
- @/components/ui/form/FormItem
- @/components/ui/form/FormLabel
- @/components/ui/form/FormMessage
- @/components/ui/select/Select
- @/components/ui/select/SelectContent
- @/components/ui/select/SelectItem
- @/components/ui/select/SelectTrigger
- _…and 12 more_

### Community 16 — onSubmit() (16) (32 nodes, cohesion: 0.06)

- dictionary-upload-card
- @/components/file-dropzone/FileDropzone
- @/components/skipped-rows-dialog/SkippedRow
- @/components/skipped-rows-dialog/SkippedRowsDialog
- @/components/ui/button/Button
- @/components/ui/card/Card
- @/components/ui/card/CardContent
- @/components/ui/card/CardDescription
- @/components/ui/card/CardHeader
- @/components/ui/card/CardTitle
- @/components/ui/form/Form
- @/components/ui/form/FormControl
- @/components/ui/form/FormField
- @/components/ui/form/FormItem
- @/components/ui/form/FormLabel
- @/components/ui/form/FormMessage
- @/components/ui/select/Select
- @/components/ui/select/SelectContent
- @/components/ui/select/SelectItem
- @/components/ui/select/SelectTrigger
- _…and 12 more_

### Community 17 — StatCard() (31 nodes, cohesion: 0.06)

- index-analyzer
- @/components/ui/badge/Badge
- @/components/ui/button/Button
- @/components/ui/card/Card
- @/components/ui/card/CardContent
- @/components/ui/card/CardDescription
- @/components/ui/card/CardHeader
- @/components/ui/card/CardTitle
- @/components/ui/empty/Empty
- @/components/ui/empty/EmptyDescription
- @/components/ui/empty/EmptyHeader
- @/components/ui/empty/EmptyMedia
- @/components/ui/empty/EmptyTitle
- @/components/ui/skeleton/Skeleton
- @/components/ui/table/Table
- @/components/ui/table/TableBody
- @/components/ui/table/TableCell
- @/components/ui/table/TableHead
- @/components/ui/table/TableHeader
- @/components/ui/table/TableRow
- _…and 11 more_

### Community 18 — StatusBadge() (31 nodes, cohesion: 0.06)

- index
- @/components/ui/badge/Badge
- @/components/ui/card/Card
- @/components/ui/card/CardContent
- @/components/ui/card/CardDescription
- @/components/ui/card/CardHeader
- @/components/ui/card/CardTitle
- @/components/ui/empty/Empty
- @/components/ui/empty/EmptyDescription
- @/components/ui/empty/EmptyHeader
- @/components/ui/empty/EmptyMedia
- @/components/ui/empty/EmptyTitle
- @/components/ui/skeleton/Skeleton
- @/components/ui/table/Table
- @/components/ui/table/TableBody
- @/components/ui/table/TableCell
- @/components/ui/table/TableHead
- @/components/ui/table/TableHeader
- @/components/ui/table/TableRow
- lucide-react/BookOpen
- _…and 11 more_

### Community 19 — @tanstack/react-router/useRouterState (30 nodes, cohesion: 0.07)

- app-sidebar
- @/components/nav-user/NavUser
- @/components/ui/sidebar/Sidebar
- @/components/ui/sidebar/SidebarContent
- @/components/ui/sidebar/SidebarFooter
- @/components/ui/sidebar/SidebarGroup
- @/components/ui/sidebar/SidebarGroupContent
- @/components/ui/sidebar/SidebarGroupLabel
- @/components/ui/sidebar/SidebarHeader
- @/components/ui/sidebar/SidebarMenu
- @/components/ui/sidebar/SidebarMenuButton
- @/components/ui/sidebar/SidebarMenuItem
- @/components/ui/sidebar/SidebarRail
- @/hooks/use-auth-session/SessionUser
- lucide-react/BookOpen
- lucide-react/DatabaseZap
- lucide-react/Gauge
- lucide-react/LayoutDashboard
- lucide-react/LayoutGrid
- lucide-react/ListChecks
- _…and 10 more_

### Community 20 — TextStyle (29 nodes, cohesion: 0.07)

- _models
- BatchResult
- .success_rate()
- ImageReplacement
- dataclasses.dataclass
- dataclasses.field
- datetime
- ._enums.TextAlign
- pptx.dml.color.RGBColor
- pptx.util.Pt
- ._types.ImageSource
- ._types.RGBTuple
- typing.Any
- typing.List
- typing.Optional
- typing.Tuple
- Position
- .to_emu()
- Replacement
- Result
- _…and 9 more_

### Community 21 — _top_failed_features_table() (29 nodes, cohesion: 0.08)

- synthetic
- _chart_feature_breakdown()
- _ellipsis_truncate()
- _empty_feature_chart()
- _feature_timing_summary_line()
- argparse
- bptx.BPTX
- bptx.TableData
- bptx.TableStyle
- bptx.template
- bptx.TextStyle
- collections.defaultdict
- constants.DATA_DIR
- datetime.date
- lib.chart.save_fig
- lib.data_processing.read_synthetic_table
- lib.data_processing.SyntheticAppMapping
- lib.data_processing.SyntheticRunRecord
- lib.report_helpers.format_date_range_list
- lib.utils.get_year_range
- _…and 9 more_

### Community 22 — @tanstack/react-router/Link (29 nodes, cohesion: 0.07)

- app-list-card
- @/components/ui/alert/Alert
- @/components/ui/alert/AlertDescription
- @/components/ui/alert/AlertTitle
- @/components/ui/button/Button
- @/components/ui/card/Card
- @/components/ui/card/CardAction
- @/components/ui/card/CardContent
- @/components/ui/card/CardDescription
- @/components/ui/card/CardHeader
- @/components/ui/card/CardTitle
- @/components/ui/empty/Empty
- @/components/ui/empty/EmptyDescription
- @/components/ui/empty/EmptyHeader
- @/components/ui/empty/EmptyMedia
- @/components/ui/empty/EmptyTitle
- @/components/ui/skeleton/Skeleton
- @/components/ui/table/Table
- @/components/ui/table/TableBody
- @/components/ui/table/TableCell
- _…and 9 more_

### Community 23 — _row_to_record() (28 nodes, cohesion: 0.12)

- postgres
- _connect()
- fetch_transaction_records_master_window()
- get_app_name()
- csv
- datetime.date
- datetime.timedelta
- functools.lru_cache
- lib.data_processing.TransactionRecord
- lib.settings.DatabaseSettings
- lib.utils.is_dev
- os
- pathlib.Path
- psycopg.rows.dict_row
- psycopg.sql
- typing.Any
- inclusive_range_half_open()
- list_app_ids()
- list_apps()
- _load_mock_apps()
- _…and 8 more_

### Community 24 — useSidebar() (27 nodes, cohesion: 0.08)

- sidebar
- cn()
- class-variance-authority/cva
- class-variance-authority/VariantProps
- @/components/ui/button/Button
- @/components/ui/input/Input
- @/components/ui/separator/Separator
- @/components/ui/sheet/Sheet
- @/components/ui/sheet/SheetContent
- @/components/ui/sheet/SheetDescription
- @/components/ui/sheet/SheetHeader
- @/components/ui/sheet/SheetTitle
- @/components/ui/skeleton/Skeleton
- @/components/ui/tooltip/Tooltip
- @/components/ui/tooltip/TooltipContent
- @/components/ui/tooltip/TooltipTrigger
- @/hooks/use-mobile/useIsMobile
- @/lib/utils/cn
- lucide-react/PanelLeftIcon
- radix-ui/Slot
- _…and 7 more_

### Community 25 — _no_data_chart() (26 nodes, cohesion: 0.08)

- template
- _chart_top_five_errors()
- bptx._framework.BPTX
- bptx.TableStyle
- bptx.TextStyle
- collections.abc.Callable
- collections.defaultdict
- constants.DATA_DIR
- datetime.date
- datetime.timedelta
- lib.chart.save_fig
- lib.data_processing.AppMapping
- lib.data_processing.read_excel
- lib.data_processing.TransactionRecord
- lib.logging.get_logger
- lib.report_helpers.aggregate_by_period
- lib.report_helpers.get_distinct_colors
- lib.report_helpers.get_table_pages
- lib.utils.format_date_range_list
- lib.utils.get_year_range
- _…and 6 more_

### Community 26 — ./start.ts/startInstance (26 nodes, cohesion: 0.08)

- routeTree.gen
- ./router.tsx/getRouter
- ./routes/api/auth/$/Route
- ./routes/api/health/Route
- ./routes/api/trpc/$/Route
- ./routes/_dashboard/application/Route
- ./routes/_dashboard/dictionary/Route
- ./routes/_dashboard/generator/Route
- ./routes/_dashboard/index/Route
- ./routes/_dashboard/Route
- ./routes/_dashboard/settings/Route
- ./routes/_dashboard/superadmin/application.$appId/Route
- ./routes/_dashboard/superadmin/audit-logs/Route
- ./routes/_dashboard/superadmin/databases/Route
- ./routes/_dashboard/superadmin/housekeeping/Route
- ./routes/_dashboard/superadmin/index-analyzer/Route
- ./routes/_dashboard/superadmin/index/Route
- ./routes/_dashboard/superadmin/jobs/Route
- ./routes/_dashboard/superadmin/users/Route
- ./routes/_dashboard/transactions/Route
- _…and 6 more_

### Community 27 — _parse_date_range() (25 nodes, cohesion: 0.10)

- db
- _as_error_type_format()
- _as_str_list()
- _auto_runtime_date_range_for_generate_date()
- _build_runtime_mapping()
- generate_for_db_mapping()
- bptx.template
- constants.TEMPLATE
- contextlib.redirect_stdout
- datetime.date
- datetime.timedelta
- generators.template.process_template
- io
- json
- lib.db.postgres.fetch_transaction_records_master_window
- lib.db.postgres.get_app_name
- lib.logging.get_pipeline_logger
- lib.report_filename.sanitize_for_filename
- lib.settings.DatabaseSettings
- pathlib.Path
- _…and 5 more_

### Community 28 — BPTX (25 nodes, cohesion: 0.10)

- BPTX
- .bytes()
- .close()
- .copy_slide()
- ._copy_slide_impl()
- .copy_slide_to()
- .__enter__()
- .__exit__()
- .find_placeholders()
- .__init__()
- .load()
- .log()
- .new()
- .remove_slide()
- .replace_image()
- .replace_image_on_slide()
- .replace_many_on_slide()
- .replace_table()
- .replace_table_on_slide()
- .replace_table_rows()
- _…and 5 more_

### Community 29 — NavUser() (23 nodes, cohesion: 0.09)

- nav-user
- @/components/ui/avatar/Avatar
- @/components/ui/avatar/AvatarFallback
- @/components/ui/dropdown-menu/DropdownMenu
- @/components/ui/dropdown-menu/DropdownMenuContent
- @/components/ui/dropdown-menu/DropdownMenuItem
- @/components/ui/dropdown-menu/DropdownMenuLabel
- @/components/ui/dropdown-menu/DropdownMenuSeparator
- @/components/ui/dropdown-menu/DropdownMenuTrigger
- @/components/ui/sidebar/SidebarMenu
- @/components/ui/sidebar/SidebarMenuButton
- @/components/ui/sidebar/SidebarMenuItem
- @/components/ui/sidebar/useSidebar
- @/hooks/use-auth-session/SessionUser
- @/lib/auth-client/authClient
- lucide-react/ChevronsUpDown
- lucide-react/Loader2
- lucide-react/LogOut
- react/useState
- @/router/trpc
- _…and 3 more_

### Community 30 — warnings (23 nodes, cohesion: 0.09)

- _framework
- builtins
- copy.deepcopy
- datetime
- ._engine.TemplateEngine
- ._exceptions.BPTXError
- ._exceptions.TemplateError
- io
- ._models.BatchResult
- ._models.Result
- ._models.TableData
- ._models.TableStyle
- ._models.TextStyle
- pptx.presentation
- pptx.util.Inches
- ._types.ImageSource
- ._types.PathLike
- typing.Any
- typing.Dict
- typing.List
- _…and 3 more_

### Community 31 — SyntheticRunRecord (23 nodes, cohesion: 0.11)

- _synthetic
- _build_col_index()
- collections.abc.Callable
- csv
- dataclasses.dataclass
- dataclasses.field
- datetime
- datetime.date
- ._excel._is_blank
- json
- ..logging.get_logger
- ._mapping._coerce_date
- pathlib.Path
- re
- typing.Optional
- is_synthetic_mapping_path()
- _parse_datetime()
- _parse_trx_date()
- _read_synthetic_csv()
- read_synthetic_table()
- _…and 3 more_

### Community 32 — ./routers/users/usersRouter (22 nodes, cohesion: 0.09)

- root
- ./init/router
- ./routers/applications/applicationsRouter
- ./routers/appMappings/appMappingsRouter
- ./routers/appProcedures/appProceduresRouter
- ./routers/auditLogs/auditLogsRouter
- ./routers/auth/authRouter
- ./routers/databases/databasesRouter
- ./routers/dictionary/dictionaryRouter
- ./routers/fdw/fdwRouter
- ./routers/generator/generatorRouter
- ./routers/housekeeping/housekeepingRouter
- ./routers/indexAnalyzer/indexAnalyzerRouter
- ./routers/noRcTransaction/noRcTransactionRouter
- ./routers/processingLogs/processingLogsRouter
- ./routers/recap/recapRouter
- ./routers/scheduler/schedulerRouter
- ./routers/setup/setupRouter
- ./routers/system/systemRouter
- ./routers/unmappedRc/unmappedRcRouter
- _…and 2 more_

### Community 33 — zod/z (33) (22 nodes, cohesion: 0.09)

- add-app-card
- @/components/ui/button/Button
- @/components/ui/card/Card
- @/components/ui/card/CardContent
- @/components/ui/card/CardDescription
- @/components/ui/card/CardHeader
- @/components/ui/card/CardTitle
- @/components/ui/form/Form
- @/components/ui/form/FormControl
- @/components/ui/form/FormField
- @/components/ui/form/FormItem
- @/components/ui/form/FormLabel
- @/components/ui/form/FormMessage
- @/components/ui/input/Input
- @hookform/resolvers/zod/zodResolver
- lucide-react/Loader2
- lucide-react/Plus
- react-hook-form/useForm
- react/useMemo
- @/router/trpc
- _…and 2 more_

### Community 34 — TestTransactionRecordClassification (22 nodes, cohesion: 0.10)

- _make_mapping()
- TestTransactionRecordClassification
- .setUp()
- .test_has_feature_name_false()
- .test_has_feature_name_true()
- .test_is_business_error_matches()
- .test_is_business_error_matches_b()
- .test_is_business_error_mismatch()
- .test_is_considered_success_includes_business_error()
- .test_is_ignored_by_error_code()
- .test_is_ignored_by_error_desc()
- .test_is_ignored_by_feature()
- .test_is_not_ignored_when_no_match()
- .test_is_success_case_insensitive()
- .test_is_success_matches_abbreviated()
- .test_is_success_matches_success_type()
- .test_is_success_mismatch()
- .test_is_system_error_matches()
- .test_is_system_error_matches_na()
- .test_is_system_error_mismatch()
- _…and 2 more_

### Community 35 — ThemeSwatch() (22 nodes, cohesion: 0.09)

- settings
- cn()
- @/components/app-setup-panel/AppSetupPanel
- @/components/theme-provider/useTheme
- @/components/ui/card/Card
- @/components/ui/card/CardContent
- @/components/ui/card/CardDescription
- @/components/ui/card/CardHeader
- @/components/ui/card/CardTitle
- @/components/ui/label/Label
- @/components/ui/radio-group/RadioGroup
- @/components/ui/radio-group/RadioGroupItem
- @/components/ui/separator/Separator
- @/components/ui/switch/Switch
- @/hooks/use-auth-session/useAuthSession
- @/hooks/use-background-mode/useBackgroundMode
- @/lib/utils/cn
- lucide-react/MonitorIcon
- react/useEffect
- react/useState
- _…and 2 more_

### Community 36 — getPageTitle() (21 nodes, cohesion: 0.10)

- _dashboard
- getPageTitle()
- @/components/animated-background/AnimatedBackground
- @/components/app-sidebar/AppSidebar
- @/components/theme-toggle/ThemeToggle
- @/components/ui/breadcrumb/Breadcrumb
- @/components/ui/breadcrumb/BreadcrumbItem
- @/components/ui/breadcrumb/BreadcrumbList
- @/components/ui/breadcrumb/BreadcrumbPage
- @/components/ui/separator/Separator
- @/components/ui/sidebar/SidebarInset
- @/components/ui/sidebar/SidebarProvider
- @/components/ui/sidebar/SidebarTrigger
- @/components/ui/skeleton/Skeleton
- @/hooks/use-auth-session/useAuthSession
- @/hooks/use-background-mode/useBackgroundMode
- react/useEffect
- @tanstack/react-router/createFileRoute
- @tanstack/react-router/Outlet
- @tanstack/react-router/useNavigate
- _…and 1 more_

### Community 37 — SlideInfo (20 nodes, cohesion: 0.11)

- _debug
- _collect_fonts()
- FontInfo
- .__str__()
- argparse
- curses
- pathlib.Path
- pptx.enum.shapes.MSO_SHAPE_TYPE
- re
- subprocess
- sys
- typing.List
- typing.NamedTuple
- typing.Optional
- typing.Tuple
- inspect()
- load_file()
- main()
- ShapeInfo
- SlideInfo

### Community 38 — runStoredProcedures() (20 nodes, cohesion: 0.23)

- addColumnSafely()
- applyPhase()
- applyProcedureFiles()
- applySqlDir()
- bind()
- columnsFor()
- detectColumnConflicts()
- isConflictProne()
- migrateExistingProcedures()
- runBetterAuthSchema()
- runCoreSchema()
- runCronSetup()
- runFdwSetup()
- runPerformanceIndexes()
- runProcessingLogSchema()
- runRecapModelProcedures()
- runRecapModelTables()
- runSchemaGroup()
- runSeeds()
- runStoredProcedures()

### Community 39 — createCredentialAccount() (20 nodes, cohesion: 0.10)

- auth
- createCredentialAccount()
- @/db/db
- @/db/schema/accounts
- @/db/schema/pendingUserRequests
- @/db/schema/users
- drizzle-orm/and
- drizzle-orm/count
- drizzle-orm/eq
- drizzle-orm/sql
- ../init/protectedProcedure
- ../init/publicProcedure
- ../init/router
- ../init/superAdminProcedure
- @/lib/audit/logAuditEvent
- @/lib/auth/hashPassword
- node:crypto/randomUUID
- @trpc/server/TRPCError
- @/types/ApiResponse
- zod/z

### Community 40 — processSuccessRateUpload() (19 nodes, cohesion: 0.11)

- success-rate
- @/db/db
- @/db/schema/appIdentifier
- @/db/schema/appSuccessRate
- @/db/schema/responseCodeDictionary
- @/db/schema/unmappedRc
- drizzle-orm/and
- drizzle-orm/eq
- drizzle-orm/inArray
- @/lib/audit/logAuditEvent
- @/lib/auth/SessionPayload
- @/lib/file-parser/buildColumnIndex
- @/lib/file-parser/getRowValue
- @/lib/file-parser/parseDateValue
- @/lib/file-parser/parseFile
- @/lib/file-parser/validateHeaders
- @/types/ApiResponse
- @/types/SuccessRateEntry
- processSuccessRateUpload()

### Community 41 — zod/z (41) (19 nodes, cohesion: 0.11)

- processingLogs
- @/db/db
- @/db/schema/appIdentifier
- @/db/schema/appProcessingLog
- drizzle-orm/and
- drizzle-orm/count
- drizzle-orm/desc
- drizzle-orm/eq
- drizzle-orm/sql
- ../init/router
- ../init/superAdminProcedure
- @/lib/application/recap/trigger-recap/RecapValidationError
- @/lib/application/recap/trigger-recap/triggerRecap
- @/lib/audit/logAuditEvent
- @/lib/domain/recap/catalog/catalogEntryToLogFilter
- @/lib/domain/recap/catalog/getCatalogEntryById
- @/lib/domain/recap/resolve-app/normalizeAppNameToKey
- @trpc/server/TRPCError
- zod/z

### Community 42 — generate_for_excel_mapping() (18 nodes, cohesion: 0.11)

- excel
- generate_for_excel_mapping()
- bptx.template
- constants.TEMPLATE
- contextlib.redirect_stdout
- datetime
- generators.template.process_template
- io
- json
- lib.data_processing.AppMapping
- lib.data_processing.read_excel
- lib.logging.get_pipeline_logger
- lib.report_filename.sanitize_for_filename
- pathlib.Path
- pipeline.common._auto_weekly_periods_clamped
- pipeline.common.GenerateResult
- typing.Any
- typing.cast

### Community 43 — TestGetLatestFourWeeksPeriod (18 nodes, cohesion: 0.11)

- test_report_helpers
- bptx._models.TableData
- datetime.date
- json
- lib.data_processing.AppMapping
- lib.data_processing.TransactionRecord
- lib.report_helpers.aggregate_by_period
- lib.report_helpers.aggregate_by_period_v2
- lib.report_helpers.get_distinct_colors
- lib.report_helpers.get_latest_four_weeks_period
- lib.report_helpers.get_table_pages
- lib.report_helpers.table_aggregate_error_key
- pathlib.Path
- tempfile.NamedTemporaryFile
- unittest
- TestGetLatestFourWeeksPeriod
- .test_each_week_has_seven_days()
- .test_returns_four_weeks()

### Community 44 — zod/z (44) (18 nodes, cohesion: 0.11)

- users
- @/db/db
- @/db/schema/accounts
- @/db/schema/users
- drizzle-orm/and
- drizzle-orm/count
- drizzle-orm/desc
- drizzle-orm/eq
- drizzle-orm/ilike
- drizzle-orm/or
- drizzle-orm/SQL
- ../init/router
- ../init/superAdminProcedure
- @/lib/audit/logAuditEvent
- @/lib/auth/hashPassword
- node:crypto/randomUUID
- @trpc/server/TRPCError
- zod/z

### Community 45 — toggleOption() (18 nodes, cohesion: 0.11)

- multi-select-filter
- @/components/ui/badge/Badge
- @/components/ui/button/Button
- @/components/ui/command/Command
- @/components/ui/command/CommandEmpty
- @/components/ui/command/CommandGroup
- @/components/ui/command/CommandInput
- @/components/ui/command/CommandItem
- @/components/ui/command/CommandList
- @/components/ui/command/CommandSeparator
- @/components/ui/popover/Popover
- @/components/ui/popover/PopoverContent
- @/components/ui/popover/PopoverTrigger
- @/components/ui/separator/Separator
- @/lib/utils/cn
- lucide-react/Check
- lucide-react/PlusCircle
- toggleOption()

### Community 46 — ./logging/appProcessingLog (18 nodes, cohesion: 0.11)

- applications
- ./dictionary/responseCodeDictionary
- ./dictionary/unmappedRc
- drizzle-orm/pg-core/date
- drizzle-orm/pg-core/decimal
- drizzle-orm/pg-core/index
- drizzle-orm/pg-core/integer
- drizzle-orm/pg-core/jsonb
- drizzle-orm/pg-core/pgTable
- drizzle-orm/pg-core/serial
- drizzle-orm/pg-core/smallint
- drizzle-orm/pg-core/text
- drizzle-orm/pg-core/timestamp
- drizzle-orm/pg-core/uniqueIndex
- drizzle-orm/pg-core/varchar
- drizzle-orm/relations
- ./enums/errorTypeEnum
- ./logging/appProcessingLog

### Community 47 — zod/z (47) (18 nodes, cohesion: 0.11)

- dictionary
- @/db/db
- @/db/schema/appIdentifier
- @/db/schema/appSuccessRate
- @/db/schema/responseCodeDictionary
- drizzle-orm/and
- drizzle-orm/asc
- drizzle-orm/count
- drizzle-orm/eq
- drizzle-orm/ilike
- drizzle-orm/inArray
- drizzle-orm/or
- drizzle-orm/sql
- ../init/protectedProcedure
- ../init/router
- @/lib/audit/logAuditEvent
- @trpc/server/TRPCError
- zod/z

### Community 48 — typing.Optional (18 nodes, cohesion: 0.11)

- _engine
- ._finder.ShapeFinder
- ._handlers.ImageHandler
- ._handlers.TableHandler
- ._handlers.TextHandler
- ._models.ImageReplacement
- ._models.Replacement
- ._models.Result
- ._models.TableData
- ._models.TableStyle
- ._models.TextStyle
- pptx.presentation
- re
- ._types.ImageSource
- typing.Any
- typing.Dict
- typing.List
- typing.Optional

### Community 49 — ImageHandler (17 nodes, cohesion: 0.12)

- _handlers
- ImageHandler
- .can_handle()
- .replace()
- ._finder.ShapeFinder
- io
- ._models.ImageReplacement
- ._models.Replacement
- ._models.Result
- ._models.TableData
- ._models.TableStyle
- pathlib.Path
- pptx.enum.shapes.MSO_SHAPE_TYPE
- pptx.oxml.ns.qn
- pptx.util.Pt
- typing.Any
- typing.List

### Community 50 — FormMessage() (17 nodes, cohesion: 0.12)

- form
- cn()
- FormControl()
- FormDescription()
- FormMessage()
- @/components/ui/label/Label
- @/lib/utils/cn
- radix-ui/Label
- radix-ui/Slot
- react
- react-hook-form/Controller
- react-hook-form/ControllerProps
- react-hook-form/FieldPath
- react-hook-form/FieldValues
- react-hook-form/FormProvider
- react-hook-form/useFormContext
- react-hook-form/useFormState

### Community 51 — main() (51) (17 nodes, cohesion: 0.13)

- migrate
- dotenv
- drizzle-orm/postgres-js/drizzle
- postgres/postgres
- ./schema-engine/applyPhase
- ./schema-engine/runBetterAuthSchema
- ./schema-engine/runCoreSchema
- ./schema-engine/runCronSetup
- ./schema-engine/runFdwSetup
- ./schema-engine/runPerformanceIndexes
- ./schema-engine/runProcessingLogSchema
- ./schema-engine/runRecapModelProcedures
- ./schema-engine/runRecapModelTables
- ./schema-engine/runSeeds
- ./schema-engine/runStoredProcedures
- log()
- main()

### Community 52 — table_aggregate_error_key() (17 nodes, cohesion: 0.13)

- report_helpers
- aggregate_by_period()
- aggregate_by_period_v2()
- get_distinct_colors()
- get_latest_four_weeks_period()
- get_table_pages()
- bptx._models.TableData
- collections.abc.Callable
- collections.defaultdict
- colorsys
- datetime.date
- datetime.timedelta
- lib.data_processing.AppMapping
- lib.data_processing.TransactionRecord
- lib.utils.format_date_range_list
- random
- table_aggregate_error_key()

### Community 53 — assignRc() (17 nodes, cohesion: 0.12)

- noRcTransaction
- assignRc()
- @/db/db
- @/db/schema/appIdentifier
- @/db/schema/appSuccessRate
- @/db/schema/responseCodeDictionary
- @/db/schema/unmappedRc
- drizzle-orm/and
- drizzle-orm/count
- drizzle-orm/eq
- drizzle-orm/isNull
- drizzle-orm/sql
- ../init/protectedProcedure
- ../init/router
- @/lib/audit/logAuditEvent
- @trpc/server/TRPCError
- zod/z

### Community 54 — @/lib/audit/logAuditEvent (17 nodes, cohesion: 0.12)

- system
- @/db/db
- @/db/schema/appIdentifier
- @/db/schema/appProcessingLog
- @/db/schema/appSuccessRate
- @/db/schema/responseCodeDictionary
- @/db/schema/unmappedRc
- drizzle-orm/and
- drizzle-orm/count
- drizzle-orm/desc
- drizzle-orm/isNull
- drizzle-orm/sql
- ../init/protectedProcedure
- ../init/publicProcedure
- ../init/router
- ../init/superAdminProcedure
- @/lib/audit/logAuditEvent

### Community 55 — __getattr__() (16 nodes, cohesion: 0.13)

- __init__
- __getattr__()
- ._convenience.new_presentation
- ._convenience.template
- ._enums.TextAlign
- ._exceptions.BPTXError
- ._exceptions.ShapeError
- ._exceptions.TemplateError
- ._framework.BPTX
- ._models.BatchResult
- ._models.Position
- ._models.Result
- ._models.Size
- ._models.TableData
- ._models.TableStyle
- ._models.TextStyle

### Community 56 — driftColumnsByTable() (16 nodes, cohesion: 0.13)

- schema-engine
- diagnose()
- driftColumnsByTable()
- drizzle-orm/SQL
- ../lib/fdw-setup/applyFdwConfig
- ../lib/password/hashPassword
- node:crypto/randomUUID
- postgres/Sql
- ./seed-schedules/SEED_JOBS
- ./sql-loader/CRON_DIR
- ./sql-loader/extractFunctionName
- ./sql-loader/INDEXES_DIR
- ./sql-loader/loadPhaseStatements
- ./sql-loader/loadProcedureFiles
- ./sql-loader/scanSqlObjects
- ./sql-loader/SCHEMA_DIR

### Community 57 — short_num_format() (16 nodes, cohesion: 0.13)

- utils
- auto_derive_weekly_periods()
- format_date_range()
- format_date_range_list()
- get_year_range()
- datetime.date
- datetime.timedelta
- os
- pathlib.Path
- platform
- re
- subprocess
- is_dev()
- reopen_in_powerpoint()
- sanitize_for_filename()
- short_num_format()

### Community 58 — CommandItem() (16 nodes, cohesion: 0.13)

- command
- cn()
- CommandGroup()
- CommandItem()
- cmdk/Command
- @/components/ui/dialog/Dialog
- @/components/ui/dialog/DialogContent
- @/components/ui/dialog/DialogDescription
- @/components/ui/dialog/DialogHeader
- @/components/ui/dialog/DialogTitle
- @/components/ui/input-group/InputGroup
- @/components/ui/input-group/InputGroupAddon
- @/lib/utils/cn
- lucide-react/CheckIcon
- lucide-react/SearchIcon
- react

### Community 59 — @tanstack/react-router/Scripts (15 nodes, cohesion: 0.13)

- __root
- @/components/theme-provider/ThemeProvider
- @/components/ui/sonner/Toaster
- @/components/ui/tooltip/TooltipProvider
- @/hooks/use-background-mode/BackgroundModeProvider
- react/ReactNode
- @/router/queryClient
- @/router/trpc
- @/router/trpcClient
- @/styles/app.css
- @tanstack/react-query/QueryClientProvider
- @tanstack/react-router/createRootRoute
- @tanstack/react-router/HeadContent
- @tanstack/react-router/Outlet
- @tanstack/react-router/Scripts

### Community 60 — _setup_root() (15 nodes, cohesion: 0.15)

- logging
- _ColourFormatter
- .format()
- get_logger()
- get_pipeline_logger()
- logging
- logging.handlers.RotatingFileHandler
- pathlib.Path
- pprint
- sys
- _PlainFormatter
- .format()
- .__init__()
- _setup_pipeline_logger()
- _setup_root()

### Community 61 — ./password/verifyPassword (15 nodes, cohesion: 0.13)

- better-auth
- better-auth/adapters/drizzle/drizzleAdapter
- better-auth/api/createAuthMiddleware
- better-auth/betterAuth
- better-auth/plugins/admin
- better-auth/plugins/username
- better-auth/tanstack-start/tanstackStartCookies
- @/db/db
- @/db/schema
- @/env/env
- @/lib/audit/getClientIp
- @/lib/audit/getUserAgent
- @/lib/audit/logAuditEvent
- ./password/hashPassword
- ./password/verifyPassword

### Community 62 — applyMapping() (15 nodes, cohesion: 0.13)

- unmappedRc
- applyMapping()
- @/db/db
- @/db/schema/appIdentifier
- @/db/schema/appSuccessRate
- @/db/schema/responseCodeDictionary
- @/db/schema/unmappedRc
- drizzle-orm/and
- drizzle-orm/count
- drizzle-orm/eq
- drizzle-orm/sql
- ../init/protectedProcedure
- ../init/router
- @/lib/audit/logAuditEvent
- zod/z

### Community 63 — validatePastDate() (15 nodes, cohesion: 0.16)

- trigger-recap
- @/db/db
- drizzle-orm/sql
- @/lib/domain/recap/catalog/catalogEntryToLogFilter
- @/lib/domain/recap/catalog/getCatalogEntryByIdAsync
- @/lib/domain/recap/resolve-app/normalizeAppNameToKey
- @/lib/domain/recap/types/TriggerRecapParams
- @/lib/domain/recap/types/TriggerRecapResult
- @/lib/logger/getLogger
- RecapValidationError
- .constructor()
- resolveAppForEntry()
- resolveTargetDate()
- triggerRecap()
- validatePastDate()

### Community 64 — react/useState (14 nodes, cohesion: 0.14)

- theme-toggle
- @/components/theme-provider/useTheme
- @/components/ui/button/Button
- @/components/ui/dropdown-menu/DropdownMenu
- @/components/ui/dropdown-menu/DropdownMenuContent
- @/components/ui/dropdown-menu/DropdownMenuItem
- @/components/ui/dropdown-menu/DropdownMenuLabel
- @/components/ui/dropdown-menu/DropdownMenuSeparator
- @/components/ui/dropdown-menu/DropdownMenuTrigger
- lucide-react/CheckIcon
- lucide-react/MonitorIcon
- lucide-react/PaletteIcon
- react/useEffect
- react/useState

### Community 65 — zod/z (65) (14 nodes, cohesion: 0.14)

- auditLogs
- @/db/db
- @/db/schema/auditLogs
- drizzle-orm/and
- drizzle-orm/count
- drizzle-orm/desc
- drizzle-orm/eq
- drizzle-orm/gte
- drizzle-orm/ilike
- drizzle-orm/lte
- drizzle-orm/sql
- ../init/router
- ../init/superAdminProcedure
- zod/z

### Community 66 — updateJobStatus() (14 nodes, cohesion: 0.22)

- scheduler-worker
- ../db/schema/scheduler/schedulerJobs
- drizzle-orm/eq
- drizzle-orm/postgres-js/drizzle
- ../lib/logger/createFileLogger
- postgres/postgres
- loadJobs()
- logJobSummary()
- refreshJobs()
- restart()
- runProcedure()
- startAll()
- stopAll()
- updateJobStatus()

### Community 67 — unusedIndexes() (14 nodes, cohesion: 0.23)

- indexAnalyzer
- findRedundant()
- @/db/db
- @/db/sql-loader/scanSqlObjects
- drizzle-orm/sql
- ../init/router
- ../init/superAdminProcedure
- indexColumns()
- indexDrift()
- missingIndexes()
- num()
- str()
- tableSizes()
- unusedIndexes()

### Community 68 — processDictionaryUpload() (13 nodes, cohesion: 0.15)

- dictionary
- @/db/db
- @/db/schema/appIdentifier
- @/db/schema/responseCodeDictionary
- drizzle-orm/eq
- drizzle-orm/sql
- @/lib/audit/logAuditEvent
- @/lib/file-parser/buildColumnIndex
- @/lib/file-parser/parseFile
- @/lib/file-parser/validateHeaders
- ./success-rate/UploadParams
- @/types/ApiResponse
- processDictionaryUpload()

### Community 69 — metaToEntry() (13 nodes, cohesion: 0.17)

- catalog
- buildRecapCatalog()
- catalogEntryToLogFilter()
- getCatalogEntryById()
- ./catalog-data.json/staticCatalog
- @/db/db
- @/db/sql-loader/loadProcedureMetas
- @/db/sql-loader/ProcedureMeta
- drizzle-orm/sql
- ./resolve-app/normalizeAppNameToKey
- ./types/RecapCatalogEntry
- ./types/RecapScope
- metaToEntry()

### Community 70 — withoutEmptyStrings() (70) (13 nodes, cohesion: 0.22)

- create-env
- createEnv()
- EnvValidationError
- .constructor()
- filterAndStripPrefix()
- getSchemaKeys()
- zod/infer
- zod/ZodError
- zod/ZodIssue
- zod/ZodType
- parseEnv()
- prettifyZodError()
- withoutEmptyStrings()

### Community 71 — ./logging/auditLogs (13 nodes, cohesion: 0.15)

- auth
- drizzle-orm/pg-core/index
- drizzle-orm/pg-core/integer
- drizzle-orm/pg-core/pgTable
- drizzle-orm/pg-core/serial
- drizzle-orm/pg-core/text
- drizzle-orm/pg-core/timestamp
- drizzle-orm/pg-core/varchar
- drizzle-orm/relations
- ./enums/requestedRoleEnum
- ./enums/requestStatusEnum
- ./enums/userRoleEnum
- ./logging/auditLogs

### Community 72 — zod/z (72) (13 nodes, cohesion: 0.15)

- appMappings
- @/db/db
- @/db/schema/appIdentifier
- @/db/schema/appMappings
- drizzle-orm/and
- drizzle-orm/asc
- drizzle-orm/eq
- ../init/protectedProcedure
- ../init/router
- ../init/superAdminProcedure
- @/lib/audit/logAuditEvent
- @trpc/server/TRPCError
- zod/z

### Community 73 — runFdwApply() (13 nodes, cohesion: 0.17)

- fdw
- createFdwClient()
- @/db/db
- drizzle-orm/sql
- @/env/env
- ../init/router
- ../init/superAdminProcedure
- @/lib/audit/logAuditEvent
- @/lib/fdw-setup/applyFdwConfig
- postgres/postgres
- @trpc/server/TRPCError
- zod/z
- runFdwApply()

### Community 74 — SkippedRowsDialog() (13 nodes, cohesion: 0.15)

- skipped-rows-dialog
- @/components/ui/alert/Alert
- @/components/ui/alert/AlertDescription
- @/components/ui/button/Button
- @/components/ui/dialog/Dialog
- @/components/ui/dialog/DialogContent
- @/components/ui/dialog/DialogDescription
- @/components/ui/dialog/DialogFooter
- @/components/ui/dialog/DialogHeader
- @/components/ui/dialog/DialogTitle
- @/components/ui/scroll-area/ScrollArea
- lucide-react/TriangleAlert
- SkippedRowsDialog()

### Community 75 — read_excel() (12 nodes, cohesion: 0.23)

- _excel
- datetime.date
- ..logging.get_logger
- ._mapping.AppMapping
- pathlib.Path
- re
- ._record.TransactionRecord
- typing.Iterator
- _is_blank()
- _parse_count()
- _parse_date()
- read_excel()

### Community 76 — DropdownMenuTrigger() (12 nodes, cohesion: 0.17)

- dropdown-menu
- cn()
- DropdownMenu()
- DropdownMenuLabel()
- DropdownMenuPortal()
- DropdownMenuShortcut()
- DropdownMenuTrigger()
- @/lib/utils/cn
- lucide-react/CheckIcon
- lucide-react/ChevronRightIcon
- radix-ui/DropdownMenu
- react

### Community 77 — drizzle-orm/relations (12 nodes, cohesion: 0.17)

- logging
- ./applications/appIdentifier
- ./auth/users
- drizzle-orm/pg-core/date
- drizzle-orm/pg-core/index
- drizzle-orm/pg-core/integer
- drizzle-orm/pg-core/pgTable
- drizzle-orm/pg-core/serial
- drizzle-orm/pg-core/text
- drizzle-orm/pg-core/timestamp
- drizzle-orm/pg-core/varchar
- drizzle-orm/relations

### Community 78 — zod/z (78) (12 nodes, cohesion: 0.17)

- setup
- @/db/db
- @/db/schema-engine/applyPhase
- @/db/schema-engine/ColumnResolutions
- @/db/schema-engine/detectColumnConflicts
- @/db/schema-engine/diagnose
- @/db/schema-engine/Phase
- ../init/router
- ../init/superAdminProcedure
- @/lib/audit/logAuditEvent
- @trpc/server/TRPCError
- zod/z

### Community 79 — SelectTrigger() (12 nodes, cohesion: 0.17)

- select
- @/lib/utils/cn
- lucide-react/CheckIcon
- lucide-react/ChevronDownIcon
- lucide-react/ChevronUpIcon
- radix-ui/Select
- react
- Select()
- SelectContent()
- SelectScrollUpButton()
- SelectSeparator()
- SelectTrigger()

### Community 80 — stripComments() (12 nodes, cohesion: 0.29)

- sql-loader
- extractFunctionName()
- node:fs
- node:path
- listSqlFiles()
- loadPhaseStatements()
- loadProcedureFiles()
- loadProcedureMetas()
- parseSqlMeta()
- scanSqlObjects()
- splitSqlStatements()
- stripComments()

### Community 81 — TablePager() (12 nodes, cohesion: 0.17)

- table-pager
- @/components/ui/button/Button
- @/components/ui/select/Select
- @/components/ui/select/SelectContent
- @/components/ui/select/SelectItem
- @/components/ui/select/SelectTrigger
- @/components/ui/select/SelectValue
- lucide-react/ChevronLeft
- lucide-react/ChevronRight
- lucide-react/ChevronsLeft
- lucide-react/ChevronsRight
- TablePager()

### Community 82 — cn() (11 nodes, cohesion: 0.18)

- breadcrumb
- Breadcrumb()
- BreadcrumbEllipsis()
- BreadcrumbPage()
- BreadcrumbSeparator()
- cn()
- @/lib/utils/cn
- lucide-react/ChevronRightIcon
- lucide-react/MoreHorizontalIcon
- radix-ui/Slot
- react

### Community 83 — getRouter() (11 nodes, cohesion: 0.18)

- router
- getBaseUrl()
- getRouter()
- ./routeTree.gen/routeTree
- @/server/trpc/root/AppRouter
- @tanstack/react-query/QueryClient
- @tanstack/react-router/createRouter
- @trpc/client/httpBatchLink
- @trpc/client/httpLink
- @trpc/client/splitLink
- @trpc/react-query/createTRPCReact

### Community 84 — TestAutoDeriveWeeklyPeriods (11 nodes, cohesion: 0.18)

- TestAutoDeriveWeeklyPeriods
- .test_custom_base()
- .test_custom_n()
- .test_default_params()
- .test_does_not_mutate_base()
- .test_each_period_seven_days_inclusive()
- .test_last_period_ends_at_base_minus_one()
- .test_n_one()
- .test_n_zero_returns_empty_list()
- .test_oldest_first()
- .test_periods_are_contiguous()

### Community 85 — TestParseDate (11 nodes, cohesion: 0.18)

- TestParseDate
- .test_date_object()
- .test_datetime_object()
- .test_dmy_dash_format()
- .test_dmy_slash_format()
- .test_empty_string_returns_none()
- .test_invalid_string_returns_none()
- .test_iso_format()
- .test_mdy_slash_format()
- .test_none_returns_none()
- .test_whitespace_string_returns_none()

### Community 86 — DialogTrigger() (11 nodes, cohesion: 0.18)

- dialog
- cn()
- Dialog()
- DialogClose()
- DialogPortal()
- DialogTrigger()
- @/components/ui/button/Button
- @/lib/utils/cn
- lucide-react/XIcon
- radix-ui/Dialog
- react

### Community 87 — formatSize() (11 nodes, cohesion: 0.18)

- file-dropzone
- clear()
- cn()
- formatSize()
- @/components/ui/button/Button
- @/lib/utils/cn
- lucide-react/FileSpreadsheet
- lucide-react/Upload
- lucide-react/X
- react/useRef
- react/useState

### Community 88 — SheetTrigger() (11 nodes, cohesion: 0.18)

- sheet
- cn()
- @/components/ui/button/Button
- @/lib/utils/cn
- lucide-react/XIcon
- radix-ui/Dialog
- react
- Sheet()
- SheetClose()
- SheetPortal()
- SheetTrigger()

### Community 89 — zod/z (89) (11 nodes, cohesion: 0.18)

- applications
- @/db/db
- @/db/schema/appIdentifier
- drizzle-orm/asc
- drizzle-orm/eq
- ../init/protectedProcedure
- ../init/router
- ../init/superAdminProcedure
- @/lib/audit/logAuditEvent
- @trpc/server/TRPCError
- zod/z

### Community 90 — TemplateEngine (10 nodes, cohesion: 0.33)

- TemplateEngine
- ._get_shape_text()
- .__init__()
- .replace()
- .replace_image()
- .replace_image_on_slide()
- .replace_on_slide()
- .replace_table()
- .replace_table_on_slide()
- .scan_placeholders()

### Community 91 — report_pptx_basename_for_preloaded_with_app() (10 nodes, cohesion: 0.20)

- report_filename
- lib.data_processing.AppMapping
- lib.data_processing.read_excel
- lib.data_processing.TransactionRecord
- lib.utils.format_date_range_list
- lib.utils.sanitize_for_filename
- pathlib.Path
- report_pptx_basename()
- report_pptx_basename_for_preloaded()
- report_pptx_basename_for_preloaded_with_app()

### Community 92 — reset_database_settings_cache() (10 nodes, cohesion: 0.24)

- settings
- DatabaseSettings
- .from_env()
- .is_configured()
- get_database_settings()
- dataclasses.dataclass
- os
- re
- _require_sql_ident()
- reset_database_settings_cache()

### Community 93 — TestAutoWeeklyPeriodsClamped (10 nodes, cohesion: 0.20)

- test_auto_weekly_periods_clamped
- datetime.date
- pathlib.Path
- pipeline.common._auto_weekly_periods_clamped
- sys
- unittest
- TestAutoWeeklyPeriodsClamped
- .test_generates_five_full_weeks_overlapping_range()
- .test_invalid_range_raises()
- .test_short_range_returns_overlapping_full_week()

### Community 94 — makeRequest() (10 nodes, cohesion: 0.20)

- rateLimit.test
- @/lib/rateLimit/checkRateLimit
- @/lib/rateLimit/enforceRateLimit
- vitest/afterEach
- vitest/beforeEach
- vitest/describe
- vitest/expect
- vitest/it
- vitest/vi
- makeRequest()

### Community 95 — ./enums/errorTypeEnum (10 nodes, cohesion: 0.20)

- dictionary
- ./applications/appIdentifier
- drizzle-orm/pg-core/integer
- drizzle-orm/pg-core/pgTable
- drizzle-orm/pg-core/serial
- drizzle-orm/pg-core/timestamp
- drizzle-orm/pg-core/unique
- drizzle-orm/pg-core/varchar
- drizzle-orm/relations
- ./enums/errorTypeEnum

### Community 96 — _write_mapping() (10 nodes, cohesion: 0.33)

- TestAppMappingFilterByDate
- ._record()
- .setUp()
- .tearDown()
- .test_filter_excludes_records_after_range()
- .test_filter_excludes_records_before_range()
- .test_filter_includes_boundary_dates()
- .test_filter_includes_records_in_range()
- .test_filter_no_date_range_returns_all()
- _write_mapping()

### Community 97 — restartSchedulerWorker() (10 nodes, cohesion: 0.20)

- scheduler
- @/db/db
- @/db/schema/scheduler/schedulerJobs
- drizzle-orm/eq
- ../init/router
- ../init/superAdminProcedure
- @/lib/audit/logAuditEvent
- @trpc/server/TRPCError
- zod/z
- restartSchedulerWorker()

### Community 98 — TestParseCount (10 nodes, cohesion: 0.20)

- TestParseCount
- .test_blank_defaults_to_zero()
- .test_comma_number_returns_none()
- .test_float_string()
- .test_integer()
- .test_invalid_string_returns_none()
- .test_none_defaults_to_zero()
- .test_rounded()
- .test_whitespace_string_defaults_to_zero()
- .test_zero()

### Community 99 — zod/z (99) (10 nodes, cohesion: 0.20)

- create-env.test
- @/lib/create-env/createEnv
- @/lib/create-env/EnvValidationError
- @/lib/create-env/parseEnv
- @/lib/create-env/prettifyZodError
- vitest/afterEach
- vitest/describe
- vitest/expect
- vitest/it
- zod/z

### Community 100 — validateHeaders() (10 nodes, cohesion: 0.24)

- file-parser
- buildColumnIndex()
- buildValidDate()
- cellToString()
- getRowValue()
- exceljs/ExcelJS
- @/lib/csv/parseCsvRows
- parseDateValue()
- parseFile()
- validateHeaders()

### Community 101 — vitest/vi (10 nodes, cohesion: 0.20)

- catalog.test
- @/lib/domain/recap/catalog/buildRecapCatalog
- @/lib/domain/recap/catalog/catalogEntryToLogFilter
- @/lib/domain/recap/catalog/getAllCatalogEntries
- @/lib/domain/recap/catalog/getCatalogEntryById
- vitest/beforeEach
- vitest/describe
- vitest/expect
- vitest/it
- vitest/vi

### Community 102 — zod/z (10 nodes, cohesion: 0.20)

- recap
- ../init/router
- ../init/superAdminProcedure
- @/lib/application/recap/trigger-recap/RecapValidationError
- @/lib/application/recap/trigger-recap/triggerRecap
- @/lib/audit/logAuditEvent
- @/lib/domain/recap/catalog/getAllCatalogEntries
- @/lib/domain/recap/catalog/getCatalogEntryByIdAsync
- @trpc/server/TRPCError
- zod/z

### Community 103 — startSchedulerWorker() (9 nodes, cohesion: 0.22)

- server
- fetch()
- @/env
- node:child_process/fork
- node:fs/existsSync
- node:path/resolve
- @tanstack/react-start/server-entry/createServerEntry
- @tanstack/react-start/server-entry/handler
- startSchedulerWorker()

### Community 104 — Handler (9 nodes, cohesion: 0.22)

- _protocol
- Handler
- .can_handle()
- .replace()
- ._models.Result
- ._types.InputT
- typing.Any
- typing.Protocol
- typing.runtime_checkable

### Community 105 — useSuperadminGuard() (105) (9 nodes, cohesion: 0.22)

- -shared
- formatDate()
- @/components/ui/badge/Badge
- @/hooks/use-auth-session/useAuthSession
- @/lib/i18n-format/formatDateTime
- react/useEffect
- @tanstack/react-router/useNavigate
- RoleBadge()
- useSuperadminGuard()

### Community 106 — sonner/ToasterProps (9 nodes, cohesion: 0.22)

- sonner
- @/components/theme-provider/useTheme
- lucide-react/CircleCheckIcon
- lucide-react/InfoIcon
- lucide-react/Loader2Icon
- lucide-react/OctagonXIcon
- lucide-react/TriangleAlertIcon
- sonner/Toaster
- sonner/ToasterProps

### Community 107 — TextHandler (9 nodes, cohesion: 0.39)

- TableHandler
- ._apply_cell_fit()
- .can_handle()
- .replace()
- ._set_cell_text()
- TextHandler
- .can_handle()
- .replace()
- .replace_global()

### Community 108 — cn() (108) (9 nodes, cohesion: 0.22)

- input-group
- cn()
- class-variance-authority/cva
- class-variance-authority/VariantProps
- @/components/ui/button/Button
- @/components/ui/input/Input
- @/components/ui/textarea/Textarea
- @/lib/utils/cn
- react

### Community 109 — ..utils.auto_derive_weekly_periods (9 nodes, cohesion: 0.22)

- _mapping
- dataclasses.dataclass
- dataclasses.field
- datetime.date
- json
- ..logging.get_logger
- pathlib.Path
- typing.Optional
- ..utils.auto_derive_weekly_periods

### Community 110 — TestGetTablePages (9 nodes, cohesion: 0.28)

- _record()
- TestAggregateByPeriod
- .test_basic_aggregation()
- .test_empty_records_returns_labels()
- .test_record_outside_all_periods_has_zero_counts()
- TestGetTablePages
- .test_empty_records_returns_empty_tables()
- .test_se_pages_and_be_page_are_table_data()
- .test_se_pages_limit_is_three()

### Community 111 — _row_to_dict() (8 nodes, cohesion: 0.32)

- mapping_db
- fetch_all_mappings()
- fetch_mapping()
- json
- lib.db.postgres._connect
- lib.settings.DatabaseSettings
- typing.Any
- _row_to_dict()

### Community 112 — MockSql (8 nodes, cohesion: 0.25)

- mock-sql
- MockSql
- .end()
- .enqueue()
- .enqueueError()
- .getQueries()
- .reset()
- .unsafe()

### Community 113 — unittest (113) (8 nodes, cohesion: 0.25)

- test_transaction_record
- datetime.date
- lib.data_processing.AppMapping
- lib.data_processing.TransactionRecord
- pathlib.Path
- tempfile.NamedTemporaryFile
- typing.Any
- unittest

### Community 114 — unittest (114) (8 nodes, cohesion: 0.25)

- test_app_mapping
- datetime.date
- json
- lib.data_processing.AppMapping
- lib.data_processing.TransactionRecord
- pathlib.Path
- tempfile.NamedTemporaryFile
- unittest

### Community 115 — zod/z (115) (8 nodes, cohesion: 0.25)

- appProcedures
- @/db/db
- drizzle-orm/sql
- ../init/router
- ../init/superAdminProcedure
- @/lib/audit/logAuditEvent
- @trpc/server/TRPCError
- zod/z

### Community 116 — vitest/it (116) (8 nodes, cohesion: 0.25)

- sql-loader.test
- @/db/sql-loader/loadProcedureMetas
- @/db/sql-loader/parseSqlMeta
- @/db/sql-loader/scanSqlObjects
- @/db/sql-loader/splitSqlStatements
- vitest/describe
- vitest/expect
- vitest/it

### Community 117 — getDb() (8 nodes, cohesion: 0.29)

- index
- createPgDb()
- getDb()
- drizzle-orm/postgres-js/drizzle
- drizzle-orm/postgres-js/PostgresJsDatabase
- @/env/env
- postgres/postgres
- ./schema

### Community 118 — SyntheticAppMapping (8 nodes, cohesion: 0.36)

- SyntheticAppMapping
- .filter_by_date()
- .from_file()
- .is_business_error()
- .is_skipped()
- .is_success()
- .is_system_error()
- .is_ignored()

### Community 119 — createTRPCContext() (8 nodes, cohesion: 0.25)

- init
- createTRPCContext()
- @/db/db
- @/lib/auth/SessionPayload
- @/lib/better-auth/auth
- @/lib/logger/getLogger
- @trpc/server/initTRPC
- @trpc/server/TRPCError

### Community 120 — GenerateResult (8 nodes, cohesion: 0.29)

- common
- _auto_weekly_periods_clamped()
- _friday_start()
- GenerateResult
- dataclasses.dataclass
- datetime.date
- datetime.timedelta
- pathlib.Path

### Community 121 — rotatingStream() (8 nodes, cohesion: 0.29)

- index
- createFileLogger()
- getLogger()
- node:fs/mkdirSync
- node:module/createRequire
- pino/pino
- rotating-file-stream/createStream
- rotatingStream()

### Community 122 — Tabs() (8 nodes, cohesion: 0.25)

- tabs
- cn()
- class-variance-authority/cva
- class-variance-authority/VariantProps
- @/lib/utils/cn
- radix-ui/Tabs
- react
- Tabs()

### Community 123 — enqueueHappyPath() (8 nodes, cohesion: 0.25)

- fdw-setup.test
- enqueueHappyPath()
- ../../helpers/mock-sql/MockSql
- @/lib/fdw-setup/applyFdwConfig
- vitest/beforeEach
- vitest/describe
- vitest/expect
- vitest/it

### Community 124 — formDataInput() (8 nodes, cohesion: 0.25)

- uploads
- clientMeta()
- extractUpload()
- formDataInput()
- ../init/protectedProcedure
- ../init/router
- @/server/uploads/dictionary/processDictionaryUpload
- @/server/uploads/success-rate/processSuccessRateUpload

### Community 125 — ._synthetic.SyntheticRunRecord (8 nodes, cohesion: 0.25)

- __init__
- ._excel.read_excel
- ._mapping.AppMapping
- ._record.TransactionRecord
- ._synthetic.is_synthetic_mapping_path
- ._synthetic.read_synthetic_table
- ._synthetic.SyntheticAppMapping
- ._synthetic.SyntheticRunRecord

### Community 126 — zod/z (126) (8 nodes, cohesion: 0.25)

- housekeeping
- @/db/db
- drizzle-orm/SQL
- ../init/router
- ../init/superAdminProcedure
- @/lib/audit/logAuditEvent
- @trpc/server/TRPCError
- zod/z

### Community 127 — TemplateError (8 nodes, cohesion: 0.29)

- _exceptions
- BPTXError
- .__init__()
- typing.Dict
- typing.Optional
- ShapeError
- .__init__()
- TemplateError

### Community 128 — useTheme() (8 nodes, cohesion: 0.29)

- theme-provider
- getResolved()
- react/createContext
- react/useContext
- react/useEffect
- react/useState
- ThemeProvider()
- useTheme()

### Community 129 — vitest/it (129) (8 nodes, cohesion: 0.25)

- file-parser.test
- @/lib/file-parser/buildColumnIndex
- @/lib/file-parser/getRowValue
- @/lib/file-parser/parseDateValue
- @/lib/file-parser/validateHeaders
- vitest/describe
- vitest/expect
- vitest/it

### Community 130 — TooltipTrigger() (8 nodes, cohesion: 0.25)

- tooltip
- @/lib/utils/cn
- radix-ui/Tooltip
- react
- Tooltip()
- TooltipContent()
- TooltipProvider()
- TooltipTrigger()

### Community 131 — TestAppMappingFromFile (8 nodes, cohesion: 0.43)

- TestAppMappingFromFile
- ._mapping_path()
- .tearDown()
- .test_core_fields_default()
- .test_date_range_none_when_omitted()
- .test_excel_col_lookup()
- .test_from_file_full()
- .test_from_file_minimal()

### Community 132 — main() (8 nodes, cohesion: 0.25)

- seed-superadmin
- ../db/db
- ../db/schema/accounts
- ../db/schema/users
- dotenv
- drizzle-orm/eq
- ../lib/password/hashPassword
- main()

### Community 133 — _run() (8 nodes, cohesion: 0.54)

- _build_shape_lines()
- draw_footer()
- draw_header()
- draw_shapes_panel()
- draw_slide_list()
- _fill()
- _put()
- _run()

### Community 134 — makeCaller() (7 nodes, cohesion: 0.29)

- auth-guards.test
- vitest/beforeEach
- vitest/describe
- vitest/expect
- vitest/it
- vitest/vi
- makeCaller()

### Community 135 — Badge() (7 nodes, cohesion: 0.29)

- badge
- Badge()
- class-variance-authority/cva
- class-variance-authority/VariantProps
- @/lib/utils/cn
- radix-ui/Slot
- react

### Community 136 — PopoverTrigger() (7 nodes, cohesion: 0.29)

- popover
- @/lib/utils/cn
- radix-ui/Popover
- react
- Popover()
- PopoverDescription()
- PopoverTrigger()

### Community 137 — vitest/it (7 nodes, cohesion: 0.29)

- fdw.test
- @/lib/fdw/fdwLocalRelationName
- @/lib/fdw/resolvePgHousekeepingRelation
- node:crypto/createHash
- vitest/describe
- vitest/expect
- vitest/it

### Community 138 — TestTableAggregateErrorKey (7 nodes, cohesion: 0.33)

- _make_mapping()
- .setUp()
- .setUp()
- TestTableAggregateErrorKey
- .setUp()
- .test_with_feature()
- .test_without_feature_uses_desc()

### Community 139 — cn() (139) (7 nodes, cohesion: 0.29)

- alert
- Alert()
- cn()
- class-variance-authority/cva
- class-variance-authority/VariantProps
- @/lib/utils/cn
- react

### Community 140 — TableHeader() (7 nodes, cohesion: 0.29)

- table
- cn()
- @/lib/utils/cn
- react
- Table()
- TableBody()
- TableHeader()

### Community 141 — drizzle-orm/pg-core/varchar (7 nodes, cohesion: 0.29)

- scheduler
- drizzle-orm/pg-core/boolean
- drizzle-orm/pg-core/pgTable
- drizzle-orm/pg-core/serial
- drizzle-orm/pg-core/text
- drizzle-orm/pg-core/timestamp
- drizzle-orm/pg-core/varchar

### Community 142 — makeSuperadminCaller() (142) (7 nodes, cohesion: 0.29)

- fdw.test
- vitest/beforeEach
- vitest/describe
- vitest/expect
- vitest/it
- vitest/vi
- makeSuperadminCaller()

### Community 143 — template() (7 nodes, cohesion: 0.29)

- _convenience
- contextlib.contextmanager
- ._framework.BPTX
- ._types.PathLike
- typing.Generator
- new_presentation()
- template()

### Community 144 — makeSuperadminCaller() (7 nodes, cohesion: 0.29)

- scheduler.test
- vitest/beforeEach
- vitest/describe
- vitest/expect
- vitest/it
- vitest/vi
- makeSuperadminCaller()

### Community 145 — TestIsBlank (7 nodes, cohesion: 0.29)

- TestIsBlank
- .test_empty_string_is_blank()
- .test_false_is_not_blank()
- .test_non_empty_string_is_not_blank()
- .test_none_is_blank()
- .test_whitespace_string_is_blank()
- .test_zero_is_not_blank()

### Community 146 — TestAutoRuntimeDateRangeForGenerateDate (7 nodes, cohesion: 0.29)

- test_auto_runtime_date_range_from_master
- datetime.date
- unittest
- TestAutoRuntimeDateRangeForGenerateDate
- .test_day_less_than_six_spans_previous_month_start_to_today()
- .test_day_one_uses_previous_full_month()
- .test_day_six_or_more_uses_current_month_start_to_today()

### Community 147 — cn() (147) (7 nodes, cohesion: 0.29)

- button
- cn()
- class-variance-authority/cva
- class-variance-authority/VariantProps
- @/lib/utils/cn
- radix-ui/Slot
- react

### Community 148 — _coerce_date() (7 nodes, cohesion: 0.38)

- AppMapping
- .excel_col()
- .filter_by_date()
- .from_dict()
- .from_file()
- ._validate_weekly_periods()
- _coerce_date()

### Community 149 — getRateLimitConfig() (7 nodes, cohesion: 0.29)

- start
- getRateLimitConfig()
- @/lib/rateLimit/checkRateLimit
- @/lib/rateLimit/RATE_LIMITS
- @/lib/rateLimit/RateLimitConfig
- @tanstack/react-start/createMiddleware
- @tanstack/react-start/createStart

### Community 150 — TransactionRecord (7 nodes, cohesion: 0.38)

- TransactionRecord
- .has_feature_name()
- .is_business_error()
- .is_considered_success()
- .is_ignored()
- .is_success()
- .is_system_error()

### Community 151 — save_fig() (7 nodes, cohesion: 0.29)

- chart
- io
- matplotlib
- matplotlib.figure
- matplotlib.pyplot
- pathlib.Path
- save_fig()

### Community 152 — SqlEditor() (7 nodes, cohesion: 0.29)

- sql-editor
- @codemirror/lang-sql/sql
- @/lib/utils/cn
- react/useEffect
- react/useState
- @uiw/react-codemirror/CodeMirror
- SqlEditor()

### Community 153 — logAuditEvent() (6 nodes, cohesion: 0.33)

- audit
- getClientIp()
- getUserAgent()
- @/db/db
- @/db/schema/auditLogs
- logAuditEvent()

### Community 154 — unittest (154) (6 nodes, cohesion: 0.33)

- test_data_processing_helpers
- datetime.date
- lib.data_processing._excel._is_blank
- lib.data_processing._excel._parse_count
- lib.data_processing._excel._parse_date
- unittest

### Community 155 — sys (6 nodes, cohesion: 0.33)

- constants
- matplotlib.font_manager
- matplotlib.pyplot
- pathlib.Path
- pptx.enum.shapes.MSO_SHAPE_TYPE
- sys

### Community 156 — ../init/superAdminProcedure (6 nodes, cohesion: 0.33)

- databases
- @/db/db
- drizzle-orm/sql
- @/env/env
- ../init/router
- ../init/superAdminProcedure

### Community 157 — TextAlign (6 nodes, cohesion: 0.33)

- _enums
- ContentType
- enum.auto
- enum.Enum
- pptx.enum.text.PP_ALIGN
- TextAlign

### Community 158 — srGenFetch() (6 nodes, cohesion: 0.33)

- generator
- ../init/protectedProcedure
- ../init/router
- @trpc/server/TRPCError
- zod/z
- srGenFetch()

### Community 159 — unittest (6 nodes, cohesion: 0.33)

- test_auto_derive_weekly_periods
- datetime.date
- datetime.timedelta
- lib.data_processing.AppMapping
- lib.utils.auto_derive_weekly_periods
- unittest

### Community 160 — @vitejs/plugin-react/react (6 nodes, cohesion: 0.33)

- vite.config
- nitro/vite/nitro
- @tailwindcss/vite/tailwindcss
- @tanstack/react-start/plugin/vite/tanstackStart
- vite/defineConfig
- @vitejs/plugin-react/react

### Community 161 — vitest/vi (161) (6 nodes, cohesion: 0.33)

- trigger-recap.test
- vitest/beforeEach
- vitest/describe
- vitest/expect
- vitest/it
- vitest/vi

### Community 162 — main() (162) (6 nodes, cohesion: 0.33)

- seed-schedules
- @/db/db
- dotenv
- drizzle-orm/sql
- node:url/fileURLToPath
- main()

### Community 163 — makeFile() (6 nodes, cohesion: 0.33)

- csv-columns.test
- @/lib/csv-columns/validateCsvColumns
- vitest/describe
- vitest/expect
- vitest/it
- makeFile()

### Community 164 — AuthLayout() (6 nodes, cohesion: 0.33)

- auth-layout
- AuthLayout()
- @/components/animated-background/AnimatedBackground
- @/hooks/use-background-mode/useBackgroundMode
- @/lib/utils/cn
- react

### Community 165 — Checkbox() (6 nodes, cohesion: 0.33)

- checkbox
- Checkbox()
- @/lib/utils/cn
- lucide-react/CheckIcon
- radix-ui/Checkbox
- react

### Community 166 — TestAppMappingAutoDerive (6 nodes, cohesion: 0.33)

- TestAppMappingAutoDerive
- .test_auto_derived_periods_are_valid()
- .test_custom_count_in_dict()
- .test_empty_weekly_periods_auto_derives()
- .test_explicit_empty_array_stays_empty()
- .test_explicit_periods_not_overwritten()

### Community 167 — ScrollBar() (6 nodes, cohesion: 0.33)

- scroll-area
- @/lib/utils/cn
- radix-ui/ScrollArea
- react
- ScrollArea()
- ScrollBar()

### Community 168 — withLogging() (6 nodes, cohesion: 0.53)

- with-logging
- durationMs()
- ./index/logger
- safeArgs()
- serializeError()
- withLogging()

### Community 169 — _sorted_distinct_features() (6 nodes, cohesion: 0.33)

- _chart_daily_sr_action()
- _format_feature_title_text()
- main()
- _paginate_action_breakdown_tables()
- process_synthetic_template()
- _sorted_distinct_features()

### Community 170 — typing.Tuple (6 nodes, cohesion: 0.33)

- _finder
- pptx.presentation
- typing.Any
- typing.Iterator
- typing.Optional
- typing.Tuple

### Community 171 — vitest/it (171) (5 nodes, cohesion: 0.40)

- docs-manifest.test
- @/lib/docs-manifest/resolveDocLink
- vitest/describe
- vitest/expect
- vitest/it

### Community 172 — vitest/it (172) (5 nodes, cohesion: 0.40)

- csv.test
- @/lib/csv/parseCsvRows
- vitest/describe
- vitest/expect
- vitest/it

### Community 173 — TestGetDistinctColors (5 nodes, cohesion: 0.40)

- TestGetDistinctColors
- .test_all_are_valid_hex()
- .test_returns_correct_count()
- .test_returns_empty_for_zero()
- .test_single_color()

### Community 174 — getUndocumentedProcedures() (5 nodes, cohesion: 0.40)

- getAllCatalogEntries()
- getCatalogEntryByIdAsync()
- getDbProcedureEntries()
- getLiveSpFunctions()
- getUndocumentedProcedures()

### Community 175 — Separator() (5 nodes, cohesion: 0.40)

- separator
- @/lib/utils/cn
- radix-ui/Separator
- react
- Separator()

### Community 176 — TestAggregateByPeriodV2 (5 nodes, cohesion: 0.40)

- TestAggregateByPeriodV2
- .setUp()
- .test_empty_records()
- .test_no_matching_records()
- .test_top_n_only_for_latest_period()

### Community 177 — cn() (177) (5 nodes, cohesion: 0.40)

- avatar
- cn()
- @/lib/utils/cn
- radix-ui/Avatar
- react

### Community 178 — @trpc/server/adapters/fetch/fetchRequestHandler (5 nodes, cohesion: 0.40)

- $
- @/server/trpc/init/createTRPCContext
- @/server/trpc/root/appRouter
- @tanstack/react-router/createFileRoute
- @trpc/server/adapters/fetch/fetchRequestHandler

### Community 179 — lib.db.postgres.month_half_open (5 nodes, cohesion: 0.40)

- __init__
- lib.db.postgres.fetch_transaction_records_master_window
- lib.db.postgres.inclusive_range_half_open
- lib.db.postgres.list_app_ids
- lib.db.postgres.month_half_open

### Community 180 — formatMonthYear() (5 nodes, cohesion: 0.40)

- i18n-format
- formatDateTime()
- formatDayMonth()
- formatMonthName()
- formatMonthYear()

### Community 181 — zod/z (181) (5 nodes, cohesion: 0.40)

- env.test
- vitest/describe
- vitest/expect
- vitest/it
- zod/z

### Community 182 — Switch() (5 nodes, cohesion: 0.40)

- switch
- @/lib/utils/cn
- radix-ui/Switch
- react
- Switch()

### Community 183 — DictionaryPage() (5 nodes, cohesion: 0.40)

- dictionary
- DictionaryPage()
- @/components/dictionary-card/DictionaryCard
- @/components/unmapped-rc-card/UnmappedRcCard
- @tanstack/react-router/createFileRoute

### Community 184 — ApplicationsPage() (5 nodes, cohesion: 0.40)

- application
- ApplicationsPage()
- @/components/add-app-card/AddAppCard
- @/components/app-list-card/AppListCard
- @tanstack/react-router/createFileRoute

### Community 185 — generateStars() (5 nodes, cohesion: 0.40)

- animated-background
- cn()
- generateStars()
- @/lib/utils/cn
- react

### Community 186 — typing.TYPE_CHECKING (5 nodes, cohesion: 0.40)

- _record
- dataclasses.dataclass
- datetime.date
- ._mapping.AppMapping
- typing.TYPE_CHECKING

### Community 187 — UploadsPage() (5 nodes, cohesion: 0.40)

- uploads
- @/components/add-success-rate-card/AddSuccessRateCard
- @/components/dictionary-upload-card/DictionaryUploadCard
- @tanstack/react-router/createFileRoute
- UploadsPage()

### Community 188 — Label() (5 nodes, cohesion: 0.40)

- label
- @/lib/utils/cn
- radix-ui/Label
- react
- Label()

### Community 189 — RoleBadge() (5 nodes, cohesion: 0.40)

- superadmin-utils
- formatDate()
- @/components/ui/badge/Badge
- @/lib/i18n-format/formatDateTime
- RoleBadge()

### Community 190 — stopScheduler() (5 nodes, cohesion: 0.50)

- scheduler
- @/lib/logger/getLogger
- initializeScheduler()
- runStoredProcedure()
- stopScheduler()

### Community 191 — ShapeFinder (5 nodes, cohesion: 0.50)

- ShapeFinder
- .all_shapes()
- .by_name()
- .by_placeholder()
- ._has_text()

### Community 192 — getSession() (5 nodes, cohesion: 0.40)

- auth
- getSession()
- ./better-auth/auth
- ./password/hashPassword
- ./password/verifyPassword

### Community 193 — vitest/it (193) (5 nodes, cohesion: 0.40)

- cron-description.test
- @/lib/cron-description/describeCron
- vitest/describe
- vitest/expect
- vitest/it

### Community 194 — useSuperadminGuard() (5 nodes, cohesion: 0.40)

- use-superadmin-guard
- @/hooks/use-auth-session/useAuthSession
- react/useEffect
- @tanstack/react-router/useNavigate
- useSuperadminGuard()

### Community 195 — applyFdwConfig() (5 nodes, cohesion: 0.40)

- fdw-setup
- applyFdwConfig()
- ./fdw/fdwLocalRelationName
- @/lib/logger/getLogger
- postgres/Sql

### Community 196 — cn() (196) (5 nodes, cohesion: 0.40)

- empty
- cn()
- class-variance-authority/cva
- class-variance-authority/VariantProps
- @/lib/utils/cn

### Community 197 — process_template() (5 nodes, cohesion: 0.40)

- _chart_daily_sr_trx()
- _chart_errors_breakdown()
- _chart_monthly_sr_trx()
- _chart_trx_breakdown()
- process_template()

### Community 198 — typing.Union (5 nodes, cohesion: 0.40)

- _types
- pathlib.Path
- typing.Tuple
- typing.TypeVar
- typing.Union

### Community 199 — cn() (199) (5 nodes, cohesion: 0.40)

- utils
- cn()
- clsx/ClassValue
- clsx/clsx
- tailwind-merge/twMerge

### Community 200 — react (5 nodes, cohesion: 0.40)

- radio-group
- @/lib/utils/cn
- lucide-react/CircleIcon
- radix-ui/RadioGroup
- react

### Community 201 — _text() (5 nodes, cohesion: 0.50)

- _effective_run_id_raw()
- _parse_optional_ms()
- _parse_required_ms()
- _row_to_record()
- _text()

### Community 202 — vitest/it (202) (5 nodes, cohesion: 0.40)

- resolve-app.test
- @/lib/domain/recap/resolve-app/normalizeAppNameToKey
- vitest/describe
- vitest/expect
- vitest/it

### Community 203 — list_synthetic_mapping_apps() (5 nodes, cohesion: 0.40)

- mapping
- constants.DATA_DIR
- json
- pathlib.Path
- list_synthetic_mapping_apps()

### Community 204 — vitest/it (204) (5 nodes, cohesion: 0.40)

- utils.test
- @/lib/utils/cn
- vitest/describe
- vitest/expect
- vitest/it

### Community 205 — resolvePgHousekeepingRelation() (4 nodes, cohesion: 0.67)

- fdw
- fdwLocalRelationName()
- node:crypto/createHash
- resolvePgHousekeepingRelation()

### Community 206 — Input() (4 nodes, cohesion: 0.50)

- input
- @/lib/utils/cn
- react
- Input()

### Community 207 — useBackgroundMode() (4 nodes, cohesion: 0.50)

- use-background-mode
- BackgroundModeProvider()
- react
- useBackgroundMode()

### Community 208 — getRateLimitKey() (4 nodes, cohesion: 0.83)

- rateLimit
- checkRateLimit()
- enforceRateLimit()
- getRateLimitKey()

### Community 209 — TransactionsPage() (4 nodes, cohesion: 0.50)

- transactions
- @/components/no-rc-transaction-card/NoRcTransactionCard
- @tanstack/react-router/createFileRoute
- TransactionsPage()

### Community 210 — cn() (210) (4 nodes, cohesion: 0.50)

- textarea
- cn()
- @/lib/utils/cn
- react

### Community 211 — main() (211) (4 nodes, cohesion: 0.50)

- dump-sp-catalog
- dotenv
- postgres/postgres
- main()

### Community 212 — better-auth/react/createAuthClient (4 nodes, cohesion: 0.50)

- auth-client
- better-auth/client/plugins/adminClient
- better-auth/client/plugins/usernameClient
- better-auth/react/createAuthClient

### Community 213 — main() (213) (4 nodes, cohesion: 0.50)

- main
- os
- uvicorn
- main()

### Community 214 — useApplications() (4 nodes, cohesion: 0.50)

- useApplications
- @/router/trpc
- @/types/Application
- useApplications()

### Community 215 — cn() (215) (4 nodes, cohesion: 0.50)

- card
- cn()
- @/lib/utils/cn
- react

### Community 216 — CronDescription() (4 nodes, cohesion: 0.50)

- cron-description
- CronDescription()
- @/components/ui/form/FormDescription
- @/lib/cron-description/describeCron

### Community 217 — @astrojs/starlight/schema/docsSchema (4 nodes, cohesion: 0.50)

- content.config
- astro:content/defineCollection
- @astrojs/starlight/loaders/docsLoader
- @astrojs/starlight/schema/docsSchema

### Community 218 — Spinner() (4 nodes, cohesion: 0.50)

- spinner
- @/lib/utils/cn
- lucide-react/Loader2Icon
- Spinner()

### Community 219 — get_db_apps() (4 nodes, cohesion: 0.50)

- db
- get_db_apps()
- lib.db.postgres.list_apps
- lib.settings.get_database_settings

### Community 220 — @tanstack/react-router/createFileRoute (220) (4 nodes, cohesion: 0.50)

- health
- @/db/db
- drizzle-orm/sql
- @tanstack/react-router/createFileRoute

### Community 221 — withoutEmptyStrings() (4 nodes, cohesion: 0.50)

- env
- dotenv/config
- zod/z
- withoutEmptyStrings()

### Community 222 — @tanstack/react-router/redirect (222) (3 nodes, cohesion: 0.67)

- index
- @tanstack/react-router/createFileRoute
- @tanstack/react-router/redirect

### Community 223 — @tanstack/react-router/redirect (3 nodes, cohesion: 0.67)

- unmapped-rc
- @tanstack/react-router/createFileRoute
- @tanstack/react-router/redirect

### Community 224 — createMockDb() (3 nodes, cohesion: 0.67)

- mock-db
- createMockDb()
- vitest/vi

### Community 225 — sys (225) (3 nodes, cohesion: 0.67)

- conftest
- pathlib.Path
- sys

### Community 226 — describeCron() (3 nodes, cohesion: 0.67)

- cron-description
- describeCron()
- cronstrue/cronstrue

### Community 227 — useAuthSession() (3 nodes, cohesion: 0.67)

- use-auth-session
- @/router/trpc
- useAuthSession()

### Community 228 — drizzle-kit/defineConfig (3 nodes, cohesion: 0.67)

- drizzle.config
- dotenv
- drizzle-kit/defineConfig

### Community 229 — Skeleton() (3 nodes, cohesion: 0.67)

- skeleton
- @/lib/utils/cn
- Skeleton()

### Community 230 — validateCsvColumns() (3 nodes, cohesion: 0.67)

- csv-columns
- @/lib/csv/parseCsvRows
- validateCsvColumns()

### Community 231 — useIsMobile() (3 nodes, cohesion: 0.67)

- use-mobile
- react
- useIsMobile()

### Community 232 — @tanstack/react-router/createFileRoute (3 nodes, cohesion: 0.67)

- $
- @/lib/better-auth/auth
- @tanstack/react-router/createFileRoute

### Community 233 — vitest/config/defineConfig (3 nodes, cohesion: 0.67)

- vitest.config
- vite-tsconfig-paths/tsconfigPaths
- vitest/config/defineConfig

### Community 234 — parseCsvRows() (2 nodes, cohesion: 1.00)

- csv
- parseCsvRows()

### Community 235 — normalizeAppNameToKey() (2 nodes, cohesion: 1.00)

- resolve-app
- normalizeAppNameToKey()

### Community 236 — tsup/defineConfig (2 nodes, cohesion: 1.00)

- tsup.config
- tsup/defineConfig

### Community 237 — drizzle-orm/pg-core/pgEnum (2 nodes, cohesion: 1.00)

- enums
- drizzle-orm/pg-core/pgEnum

### Community 238 — __init__ (1 nodes, cohesion: 1.00)

- __init__

### Community 239 — __init__ (239) (1 nodes, cohesion: 1.00)

- __init__

### Community 240 — setup (1 nodes, cohesion: 1.00)

- setup

### Community 241 — index (1 nodes, cohesion: 1.00)

- index

### Community 242 — types (1 nodes, cohesion: 1.00)

- types

### Community 243 — index (243) (1 nodes, cohesion: 1.00)

- index

### Community 244 — superadmin (1 nodes, cohesion: 1.00)

- superadmin

## 🕳️ Knowledge Gaps

**Isolated nodes** (7):
- setup
- index
- superadmin
- types
- index
- __init__
- __init__

**Thin communities** (< 3 nodes): 11 communities

## 💰 Token Cost

| File | Tokens |
|------|--------|
| output | 0 |
| input | 0 |
| **Total** | **0** |

## ❓ Suggested Questions

1. How does 'apps_sr_generator_tests_test_report_helpers_py_testaggregatebyperiod' relate to 3 different communities (TestGetTablePages, TestGetLatestFourWeeksPeriod, TestTableAggregateErrorKey)?
1. How does 'apps_sr_generator_tests_test_app_mapping_py' relate to 3 different communities (TestAppMappingFromFile, _write_mapping(), unittest (114))?
1. How does 'apps_sr_generator_tests_test_app_mapping_py_write_mapping' relate to 3 different communities (unittest (114), TestAppMappingFromFile, _write_mapping())?
1. How does 'apps_sr_generator_tests_test_report_helpers_py_make_mapping' relate to 3 different communities (TestGetLatestFourWeeksPeriod, TestTableAggregateErrorKey, TestAggregateByPeriodV2)?
1. How does 'apps_sr_generator_tests_test_data_processing_helpers_py' relate to 4 different communities (unittest (154), TestParseDate, TestParseCount, TestIsBlank)?
1. How does 'apps_sr_generator_tests_test_auto_derive_weekly_periods_py' relate to 3 different communities (TestAppMappingAutoDerive, TestAutoDeriveWeeklyPeriods, unittest)?
1. How does 'apps_sr_generator_src_lib_data_processing_synthetic_py' relate to 3 different communities (SyntheticRunRecord, SyntheticAppMapping, _text())?

---
_Generated by graphify-rs_
