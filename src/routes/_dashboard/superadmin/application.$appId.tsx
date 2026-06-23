import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, ChevronRight, Code2, Loader2, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { CronDescription } from '@/components/cron-description'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { SqlEditor } from '@/components/ui/sql-editor'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { m } from '@/paraglide/messages'
import { trpc } from '@/router'
import { formatDate, useSuperadminGuard } from './-shared'

export const Route = createFileRoute('/_dashboard/superadmin/application/$appId')({
  ssr: false,
  component: AppConfigPage,
})

type RawTableFormValues = { db_name: string; raw_table_name: string }

type ProcedureFormValues = {
  function_name: string
  recap_kind: string
  output_table: string
  schedule_cron?: string
  description?: string
  sql_text: string
}

function buildSqlTemplate(functionName: string, appName: string): string {
  return `CREATE OR REPLACE FUNCTION public.${functionName}(p_processing_date DATE DEFAULT NULL)
RETURNS void AS $$
DECLARE
  v_app_id INT;
  v_app_name VARCHAR(255) := '${appName}';
  v_processing_date DATE;
  v_log_id INT;
  v_error_msg TEXT;
  v_records_processed INT := 0;
  v_records_inserted INT := 0;
BEGIN
  IF p_processing_date IS NULL THEN
    v_processing_date := CURRENT_DATE - INTERVAL '1 day';
  ELSE
    v_processing_date := p_processing_date;
  END IF;

  SELECT id INTO v_app_id FROM app_identifier WHERE app_name = v_app_name LIMIT 1;
  IF v_app_id IS NULL THEN
    RAISE EXCEPTION 'Application % not found in app_identifier table', v_app_name;
  END IF;

  INSERT INTO app_processing_log (app_name, id_app_identifier, processing_date, start_time, status, catalog_entry_id)
  VALUES (v_app_name, v_app_id, v_processing_date, NOW(), 'running', 'cp:${functionName}')
  RETURNING id INTO v_log_id;

  BEGIN
    DELETE FROM app_success_rate WHERE id_app_identifier = v_app_id AND tanggal_transaksi = v_processing_date;

    -- TODO: aggregate from your raw table and insert into app_success_rate
    -- INSERT INTO app_success_rate (id_app_identifier, tanggal_transaksi, bulan, tahun, ...)
    -- SELECT v_app_id, ... FROM <your_raw_table> WHERE ...;

    UPDATE app_processing_log
      SET status = 'success', end_time = NOW(),
          records_processed = v_records_processed, records_inserted = v_records_inserted
    WHERE id = v_log_id;

  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_msg = MESSAGE_TEXT;
    UPDATE app_processing_log SET status = 'failed', end_time = NOW(), error_message = v_error_msg
    WHERE id = v_log_id;
    RAISE;
  END;
END;
$$ LANGUAGE plpgsql;`
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function AppConfigPage() {
  const { isSuperadmin } = useSuperadminGuard()
  const { appId: appIdParam } = Route.useParams()
  const appIdNum = parseInt(appIdParam, 10)
  const utils = trpc.useUtils()

  // App data
  const appQuery = trpc.applications.get.useQuery({ id: appIdNum }, { enabled: isSuperadmin && !isNaN(appIdNum) })
  const app = appQuery.data?.data?.application

  // Procedures list
  const procQuery = trpc.appProcedures.listForApp.useQuery(
    { appId: appIdNum },
    { enabled: isSuperadmin && !isNaN(appIdNum) },
  )
  const procedures = (procQuery.data?.data?.procedures ?? []) as any[]

  const rawTableSchema = useMemo(
    () =>
      z.object({
        db_name: z.string().trim().min(1, m.validation_db_name_required()),
        raw_table_name: z.string().trim().min(1, m.validation_raw_table_name_required()),
      }),
    [],
  )

  // Raw table form
  const rawForm = useForm<RawTableFormValues>({
    resolver: zodResolver(rawTableSchema),
    values: {
      db_name: app?.db_name ?? '',
      raw_table_name: app?.raw_table_name ?? '',
    },
  })

  const updateConfigMutation = trpc.applications.updateConfig.useMutation({
    onSuccess: () => {
      toast.success(m.appcfg_toast_config_saved())
      utils.applications.get.invalidate({ id: appIdNum })
      utils.applications.list.invalidate()
    },
    onError: (e) => toast.error(e.message || m.appcfg_toast_config_err()),
  })

  const procedureSchema = useMemo(
    () =>
      z.object({
        function_name: z
          .string()
          .trim()
          .regex(/^sp_[a-z0-9_]{2,55}$/, 'Must match sp_[a-z0-9_]{2,55}'),
        recap_kind: z.string().trim().min(1, m.validation_required()),
        output_table: z.string().trim().min(1, m.validation_required()),
        schedule_cron: z.string().trim().optional(),
        description: z.string().trim().max(500).optional(),
        sql_text: z.string().min(50, m.validation_sql_required()),
      }),
    [],
  )

  // Procedure form
  const [showProcForm, setShowProcForm] = useState(false)
  const procForm = useForm<ProcedureFormValues>({
    resolver: zodResolver(procedureSchema),
    defaultValues: {
      function_name: '',
      recap_kind: 'success_rate_daily',
      output_table: 'app_success_rate',
      schedule_cron: '',
      description: '',
      sql_text: '',
    },
  })

  const registerProcMutation = trpc.appProcedures.register.useMutation({
    onSuccess: (res) => {
      toast.success(res.message)
      procForm.reset()
      setShowProcForm(false)
      utils.appProcedures.listForApp.invalidate({ appId: appIdNum })
    },
    onError: (e) => toast.error(e.message || m.appcfg_toast_register_err()),
  })

  const removeProcMutation = trpc.appProcedures.remove.useMutation({
    onSuccess: (res) => {
      toast.success(res.message)
      utils.appProcedures.listForApp.invalidate({ appId: appIdNum })
    },
    onError: (e) => toast.error(e.message || m.appcfg_toast_remove_err()),
  })

  if (isNaN(appIdNum)) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">{m.appcfg_invalid_app_id()}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="-ml-1 h-7" asChild>
          <Link to="/application">
            <ArrowLeft className="size-3.5" />
            {m.nav_applications()}
          </Link>
        </Button>
        <ChevronRight className="size-3.5 text-muted-foreground" />
        {appQuery.isLoading ? (
          <Skeleton className="h-5 w-32" />
        ) : (
          <span className="text-sm font-medium">{app?.app_name ?? m.appcfg_app_fallback({ id: appIdNum })}</span>
        )}
      </div>

      <header>
        <h1 className="text-lg font-semibold tracking-tight">
          {app ? m.appcfg_title_with_app({ appName: app.app_name }) : m.nav_app_config()}
        </h1>
        <p className="text-sm text-muted-foreground">{m.appcfg_subtitle()}</p>
      </header>

      {/* Raw table mapping */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">{m.appcfg_raw_table_title()}</CardTitle>
          <CardDescription>{m.appcfg_raw_table_desc()}</CardDescription>
        </CardHeader>
        <CardContent>
          {appQuery.isLoading ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : (
            <Form {...rawForm}>
              <form
                onSubmit={rawForm.handleSubmit((values) => updateConfigMutation.mutate({ id: appIdNum, ...values }))}
                className="flex flex-col gap-4"
              >
                <FormField
                  control={rawForm.control}
                  name="db_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{m.appcfg_db_name_label()}</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. bale_db" className="font-mono" {...field} />
                      </FormControl>
                      <FormDescription>{m.appcfg_db_name_desc()}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={rawForm.control}
                  name="raw_table_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{m.appcfg_raw_table_name_label()}</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. raw_bale" className="font-mono" {...field} />
                      </FormControl>
                      <FormDescription>{m.appcfg_raw_table_name_desc()}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div>
                  <Button type="submit" disabled={updateConfigMutation.isPending}>
                    {updateConfigMutation.isPending && <Loader2 className="animate-spin" />}
                    {m.common_save()}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>

      {/* Stored procedures */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">{m.appcfg_procedures_title()}</h2>
            <p className="text-sm text-muted-foreground">{m.appcfg_procedures_desc()}</p>
          </div>
          {!showProcForm && (
            <Button size="sm" onClick={() => setShowProcForm(true)}>
              <Plus className="size-3.5" />
              {m.appcfg_register_procedure()}
            </Button>
          )}
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-[1fr_420px]">
          {/* Procedures list */}
          <Card className="py-0">
            <CardContent className="p-0">
              {procQuery.isLoading ? (
                <div className="flex flex-col gap-2 p-4">
                  {Array.from({ length: 3 }, (_, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : procedures.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Code2 />
                    </EmptyMedia>
                    <EmptyTitle>{m.appcfg_empty_procedures_title()}</EmptyTitle>
                    <EmptyDescription>{m.appcfg_empty_procedures_desc()}</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{m.appcfg_col_function()}</TableHead>
                      <TableHead>{m.appcfg_col_kind()}</TableHead>
                      <TableHead>{m.appcfg_col_output_table()}</TableHead>
                      <TableHead>{m.appcfg_col_registered()}</TableHead>
                      <TableHead className="w-20 text-right">{m.common_actions()}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {procedures.map((row: any) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-mono text-xs">public.{row.function_name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {row.recap_kind}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{row.output_table}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {row.created_at ? formatDate(row.created_at) : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-destructive hover:text-destructive"
                            onClick={() => removeProcMutation.mutate({ id: row.id })}
                            disabled={removeProcMutation.isPending}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Register procedure form */}
          {showProcForm && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium">{m.appcfg_register_procedure()}</CardTitle>
                <CardDescription>
                  {m.appcfg_register_desc_part1()}{' '}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">CREATE OR REPLACE FUNCTION</code>{' '}
                  {m.appcfg_register_desc_part2()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...procForm}>
                  <form
                    onSubmit={procForm.handleSubmit((values) =>
                      registerProcMutation.mutate({ appId: appIdNum, ...values }),
                    )}
                    className="flex flex-col gap-4"
                  >
                    <FormField
                      control={procForm.control}
                      name="function_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{m.appcfg_function_name_label()}</FormLabel>
                          <FormControl>
                            <Input placeholder="sp_process_myapp_daily" className="font-mono" {...field} />
                          </FormControl>
                          <FormDescription>Format: sp_[a-z0-9_]{'{2,55}'}</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={procForm.control}
                      name="recap_kind"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{m.appcfg_recap_kind_label()}</FormLabel>
                          <FormControl>
                            <Input placeholder="success_rate_daily" className="font-mono" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={procForm.control}
                      name="output_table"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{m.appcfg_output_table_label()}</FormLabel>
                          <FormControl>
                            <Input placeholder="app_success_rate" className="font-mono" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={procForm.control}
                      name="schedule_cron"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{m.appcfg_schedule_label()}</FormLabel>
                          <FormControl>
                            <Input placeholder="1 0 * * *" className="font-mono" {...field} />
                          </FormControl>
                          <CronDescription value={field.value ?? ''} />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={procForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{m.appcfg_description_label()}</FormLabel>
                          <FormControl>
                            <Input placeholder={m.appcfg_description_ph()} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={procForm.control}
                      name="sql_text"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between">
                            <FormLabel>SQL</FormLabel>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs"
                              onClick={() => {
                                const fn = procForm.getValues('function_name') || 'sp_process_myapp_daily'
                                const appName = app?.app_name ?? ''
                                procForm.setValue('sql_text', buildSqlTemplate(fn, appName), {
                                  shouldValidate: true,
                                })
                              }}
                            >
                              {m.appcfg_use_template()}
                            </Button>
                          </div>
                          <FormControl>
                            <SqlEditor
                              value={field.value}
                              onChange={field.onChange}
                              onBlur={field.onBlur}
                              placeholder="CREATE OR REPLACE FUNCTION public.sp_process_myapp_daily(p_processing_date DATE DEFAULT NULL) RETURNS void AS $$ ..."
                            />
                          </FormControl>
                          <FormDescription>
                            {m.appcfg_sql_desc_part1()}{' '}
                            <code className="rounded bg-muted px-1 py-0.5 text-xs">
                              CREATE OR REPLACE FUNCTION public.&lt;function_name&gt;(
                            </code>{' '}
                            {m.appcfg_sql_desc_part2()}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex gap-2">
                      <Button type="submit" disabled={registerProcMutation.isPending}>
                        {registerProcMutation.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
                        {m.appcfg_install_register()}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          procForm.reset()
                          setShowProcForm(false)
                        }}
                      >
                        {m.common_cancel()}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
