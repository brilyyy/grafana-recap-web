import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { AlertCircle, CircleCheck, Gauge, Info, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { trpc } from '@/router'

export const Route = createFileRoute('/register')({
  ssr: false,
  component: RegisterPage,
})

const schema = z
  .object({
    username: z.string().min(1, 'Username is required'),
    email: z.string().email('Enter a valid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters long'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type FormValues = z.infer<typeof schema>

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
          setSuccess(
            'Registration request submitted successfully! Please wait for superadmin approval before you can login.',
          )
          form.reset()
        } else {
          setSuccess('Admin user created successfully! Redirecting to login...')
          setTimeout(() => navigate({ to: '/login' }), 2000)
        }
      } else {
        form.setError('root', { message: (data as { message?: string }).message || 'Registration failed' })
      }
    } catch (error) {
      form.setError('root', {
        message: error instanceof Error ? error.message : 'An error occurred. Please try again.',
      })
    }
  }

  if (checking) {
    return (
      <div className="grid min-h-svh place-items-center bg-muted/40 p-6">
        <div className="flex w-full max-w-sm flex-col gap-4">
          <Skeleton className="h-8 w-40 self-center" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="grid min-h-svh place-items-center bg-muted/40 p-6">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex items-center justify-center gap-2 font-medium">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Gauge className="size-4" />
          </div>
          Grafana Recap
        </div>
        <Card>
          <CardHeader className="text-center">
            <CardTitle>{adminExists ? 'Request admin account' : 'Create first admin account'}</CardTitle>
            <CardDescription>
              {adminExists
                ? 'Submit a request for an admin account. Superadmin approval required.'
                : 'Set up your first admin account to access the dashboard.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {adminExists && (
              <Alert>
                <Info />
                <AlertDescription>
                  Your request will be reviewed by a superadmin before you can login.
                </AlertDescription>
              </Alert>
            )}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
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
                      <FormLabel>Email</FormLabel>
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
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" autoComplete="new-password" placeholder="Min. 8 characters" {...field} />
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
                      <FormLabel>Confirm password</FormLabel>
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
                  {adminExists ? 'Submit admin request' : 'Create admin account'}
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="justify-center text-sm text-muted-foreground">
            Already have an account?
            <Link to="/login" className="ml-1 text-foreground underline-offset-4 hover:underline">
              Sign in
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
