import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { AlertCircle, CircleCheck, Gauge, Info, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { AuthLayout } from '@/components/auth-layout'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { m } from '@/paraglide/messages'
import { trpc } from '@/router'

export const Route = createFileRoute('/register')({
  ssr: false,
  component: RegisterPage,
})

type FormValues = { username: string; email: string; password: string; confirmPassword: string }

function RegisterPage() {
  const navigate = useNavigate()
  const [success, setSuccess] = useState('')

  const { data: authCheck } = trpc.auth.check.useQuery(undefined, { retry: false })
  const { data: adminCheck, isLoading: checking } = trpc.auth.checkAdmin.useQuery()
  const createAdmin = trpc.auth.createAdmin.useMutation()

  const adminExists = adminCheck?.data?.adminExists ?? null

  useEffect(() => {
    if (authCheck?.data?.authenticated) {
      navigate({ to: '/', replace: true })
    }
  }, [authCheck, navigate])

  // Built per render so validation messages resolve in the active locale.
  const schema = useMemo(
    () =>
      z
        .object({
          username: z.string().min(1, m.validation_username_required()),
          email: z.string().email(m.validation_email_invalid()),
          password: z.string().min(8, m.validation_password_min8()),
          confirmPassword: z.string().min(1, m.validation_confirm_password_required()),
        })
        .refine((values) => values.password === values.confirmPassword, {
          message: m.validation_passwords_mismatch(),
          path: ['confirmPassword'],
        }),
    [],
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { username: '', email: '', password: '', confirmPassword: '' },
  })

  const onSubmit = async (values: FormValues) => {
    setSuccess('')
    try {
      const data = await createAdmin.mutateAsync({
        username: values.username,
        email: values.email,
        password: values.password,
      })
      if (data.success) {
        if ((data.data as { status?: string } | undefined)?.status === 'pending') {
          setSuccess(m.register_success_pending())
          form.reset()
        } else {
          setSuccess(m.register_success_created())
          setTimeout(() => navigate({ to: '/login' }), 2000)
        }
      } else {
        form.setError('root', { message: (data as { message?: string }).message || m.register_error_failed() })
      }
    } catch (error) {
      form.setError('root', {
        message: error instanceof Error ? error.message : m.register_error_generic(),
      })
    }
  }

  if (checking) {
    return (
      <AuthLayout>
        <Skeleton className="h-8 w-40 self-center" />
        <Skeleton className="h-96 w-full" />
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <div className="flex items-center justify-center gap-2 font-medium">
        <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Gauge className="size-4" />
        </div>
        {m.common_app_name()}
      </div>
      <Card>
        <CardHeader className="text-center">
          <CardTitle>{adminExists ? m.register_title_request() : m.register_title_first()}</CardTitle>
          <CardDescription>{adminExists ? m.register_desc_request() : m.register_desc_first()}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {adminExists && (
            <Alert>
              <Info />
              <AlertDescription>{m.register_info_review()}</AlertDescription>
            </Alert>
          )}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{m.register_username()}</FormLabel>
                    <FormControl>
                      <Input autoComplete="username" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{m.register_email()}</FormLabel>
                    <FormControl>
                      <Input type="email" autoComplete="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{m.register_password()}</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        placeholder={m.register_password_ph()}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{m.register_confirm_password()}</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {form.formState.errors.root && (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertDescription>{form.formState.errors.root.message}</AlertDescription>
                </Alert>
              )}
              {success && (
                <Alert>
                  <CircleCheck />
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
                {adminExists ? m.register_submit_request() : m.register_submit_create()}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="justify-center text-sm text-muted-foreground">
          {m.register_have_account()}
          <Link to="/login" className="ml-1 text-foreground underline-offset-4 hover:underline">
            {m.register_signin()}
          </Link>
        </CardFooter>
      </Card>
    </AuthLayout>
  )
}
