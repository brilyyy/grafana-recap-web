import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Plus } from 'lucide-react'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { m } from '@/paraglide/messages'
import { trpc } from '@/router'

type FormValues = { app_name: string }

export default function AddAppCard() {
  const schema = useMemo(
    () => z.object({ app_name: z.string().trim().min(1, m.validation_app_name_required()) }),
    [],
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { app_name: '' },
  })
  const utils = trpc.useUtils()

  const createApp = trpc.applications.create.useMutation({
    onSuccess: (result, vars) => {
      if (!result.success) {
        toast.error(result.message || m.addapp_toast_err())
        return
      }
      toast.success(m.addapp_toast_added({ appName: vars.app_name }))
      form.reset()
      utils.applications.list.invalidate()
    },
    onError: (error) => {
      toast.error(error.message || m.addapp_toast_err())
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">{m.addapp_title()}</CardTitle>
        <CardDescription>{m.addapp_desc()}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((values) => createApp.mutate(values))} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="app_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{m.addapp_name_label()}</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. BRImo" autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={createApp.isPending}>
              {createApp.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
              {m.addapp_title()}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
