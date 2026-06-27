import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Upload } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { FileDropzone } from '@/components/file-dropzone'
import { type SkippedRow, SkippedRowsDialog } from '@/components/skipped-rows-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useApplications } from '@/hooks/useApplications'
import { validateCsvColumns } from '@/lib/csv-columns'
import { m } from '@/paraglide/messages'
import { trpc } from '@/router'

const REQUIRED_COLUMNS = ['Jenis Transaksi', 'RC', 'S/N']
const OPTIONAL_COLUMNS = ['RC Description']

type FormValues = { appId: string; file: File }

interface SkippedRowsState {
  rows: SkippedRow[]
  totalSkipped: number
  totalProcessed: number
}

export default function DictionaryUploadCard() {
  const { applications } = useApplications()
  const utils = trpc.useUtils()
  const uploadMutation = trpc.uploads.dictionary.useMutation()
  const [skipped, setSkipped] = useState<SkippedRowsState | null>(null)

  const schema = useMemo(
    () =>
      z.object({
        appId: z.string().min(1, m.upload_select_app_required()),
        file: z
          .custom<File>((f) => f instanceof File, m.upload_file_required())
          .refine((f) => /\.(xlsx|csv)$/i.test(f.name), m.upload_file_type_invalid())
          .superRefine(async (f, ctx) => {
            if (!/\.(xlsx|csv)$/i.test(f.name)) return
            const result = await validateCsvColumns(f, REQUIRED_COLUMNS, OPTIONAL_COLUMNS)
            if (!result.isValid) {
              ctx.addIssue({ code: 'custom', message: result.error ?? m.upload_file_format_invalid() })
            }
          }),
      }),
    [],
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { appId: '' },
  })

  const onSubmit = async (values: FormValues) => {
    try {
      const formData = new FormData()
      formData.append('dictionaryFile', values.file)
      formData.append('selectedApplicationId', values.appId)

      const result = await uploadMutation.mutateAsync(formData)

      if (result.success) {
        toast.success(result.message || m.dictup_toast_uploaded())
        form.reset()
        utils.invalidate()
      } else if (result.data?.skippedRows) {
        setSkipped({
          rows: result.data.skippedRows,
          totalSkipped: result.data.totalSkipped || 0,
          totalProcessed: result.data.totalProcessed || 0,
        })
      } else {
        toast.error(result.message || m.upload_failed_fallback())
      }
    } catch (error) {
      toast.error(
        m.upload_failed_with_error({ error: error instanceof Error ? error.message : m.proc_unknown_error() }),
      )
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">{m.dictup_title()}</CardTitle>
        <CardDescription>{m.dictup_desc()}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="appId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{m.upload_app_label()}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={m.upload_app_ph()} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {applications.map((app) => (
                        <SelectItem key={app.id} value={String(app.id)}>
                          {app.app_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="file"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{m.upload_file_label()}</FormLabel>
                  <FormControl>
                    <FileDropzone
                      value={field.value ?? null}
                      onChange={(file) => field.onChange(file ?? undefined)}
                      disabled={form.formState.isSubmitting}
                      hint={
                        <div>
                          <p>{m.upload_file_hint_type()}</p>
                          <p>{m.upload_file_hint_required({ columns: REQUIRED_COLUMNS.join(', ') })}</p>
                          <p>{m.upload_file_hint_optional({ columns: OPTIONAL_COLUMNS.join(', ') })}</p>
                        </div>
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : <Upload />}
              {m.dictup_submit()}
            </Button>
          </form>
        </Form>
      </CardContent>

      <SkippedRowsDialog
        isOpen={skipped !== null}
        onClose={() => setSkipped(null)}
        skippedRows={skipped?.rows ?? []}
        totalSkipped={skipped?.totalSkipped ?? 0}
        totalProcessed={skipped?.totalProcessed ?? 0}
      />
    </Card>
  )
}
