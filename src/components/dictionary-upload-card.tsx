import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Upload } from 'lucide-react'
import { useState } from 'react'
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
import { trpc } from '@/router'

const REQUIRED_COLUMNS = ['Jenis Transaksi', 'RC', 'S/N']
const OPTIONAL_COLUMNS = ['RC Description']

const schema = z.object({
  appId: z.string().min(1, 'Please select an application'),
  file: z
    .custom<File>((f) => f instanceof File, 'Please select a file to upload')
    .refine((f) => /\.(xlsx|csv)$/i.test(f.name), 'Only Excel (.xlsx) or CSV (.csv) files are allowed')
    .superRefine(async (f, ctx) => {
      if (!/\.(xlsx|csv)$/i.test(f.name)) return
      const result = await validateCsvColumns(f, REQUIRED_COLUMNS, OPTIONAL_COLUMNS)
      if (!result.isValid) {
        ctx.addIssue({ code: 'custom', message: result.error ?? 'Invalid file format' })
      }
    }),
})

type FormValues = z.infer<typeof schema>

interface SkippedRowsState {
  rows: SkippedRow[]
  totalSkipped: number
  totalProcessed: number
}

export default function DictionaryUploadCard() {
  const { applications } = useApplications()
  const utils = trpc.useUtils()
  const [skipped, setSkipped] = useState<SkippedRowsState | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { appId: '' },
  })

  const onSubmit = async (values: FormValues) => {
    try {
      const formData = new FormData()
      formData.append('dictionaryFile', values.file)
      formData.append('selectedApplicationId', values.appId)

      const response = await fetch('/api/upload-dictionary', { method: 'POST', body: formData })
      const result = await response.json()

      if (result.success) {
        toast.success(result.message || 'Dictionary uploaded')
        form.reset()
        utils.invalidate()
      } else if (result.data?.skippedRows) {
        setSkipped({
          rows: result.data.skippedRows,
          totalSkipped: result.data.totalSkipped || 0,
          totalProcessed: result.data.totalProcessed || 0,
        })
      } else {
        toast.error(result.message || 'Upload failed')
      }
    } catch (error) {
      toast.error(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">Dictionary document</CardTitle>
        <CardDescription>Upload response-code mappings for an application.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="appId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Application</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select application" />
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
                  <FormLabel>File</FormLabel>
                  <FormControl>
                    <FileDropzone
                      value={field.value ?? null}
                      onChange={(file) => field.onChange(file ?? undefined)}
                      disabled={form.formState.isSubmitting}
                      hint={
                        <div>
                          <p>Excel (.xlsx) or CSV (.csv) file</p>
                          <p>Required: {REQUIRED_COLUMNS.join(', ')}</p>
                          <p>Optional: {OPTIONAL_COLUMNS.join(', ')}</p>
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
              Upload dictionary
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
