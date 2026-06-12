import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Plus } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { trpc } from '@/router'

const schema = z.object({
  app_name: z.string().trim().min(1, 'Application name is required'),
})

type FormValues = z.infer<typeof schema>

export default function AddAppCard() {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { app_name: '' },
  })
  const utils = trpc.useUtils()

  const createApp = trpc.applications.create.useMutation({
    onSuccess: (result, vars) => {
      if (!result.success) {
        toast.error(result.message || 'Failed to add application')
        return
      }
      toast.success(`Application "${vars.app_name}" added`)
      form.reset()
      utils.applications.list.invalidate()
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to add application')
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">Add application</CardTitle>
        <CardDescription>Register a new application to track.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((values) => createApp.mutate(values))} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="app_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Application name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. BRImo" autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={createApp.isPending}>
              {createApp.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
              Add application
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
