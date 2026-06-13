import { createFileRoute, Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { useEffect } from 'react'
import { DashboardBackground } from '@/components/dashboard-background'
import { AppSidebar } from '@/components/app-sidebar'
import { ThemeToggle } from '@/components/theme-toggle'
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthSession } from '@/hooks/use-auth-session'

export const Route = createFileRoute('/_dashboard')({
  ssr: false,
  component: DashboardLayout,
})

const pageTitles: Record<string, string> = {
  '/': 'Summary',
  '/application': 'Applications',
  '/dictionary': 'Dictionary',
  '/uploads': 'Uploads',
  '/unmapped-rc': 'Unmapped RC',
  '/transactions': 'Transactions',
  '/superadmin/users': 'Users',
  '/superadmin/audit-logs': 'Audit logs',
  '/superadmin/processing': 'Processing',
  '/superadmin/jobs': 'Jobs',
  '/superadmin/scheduler': 'Scheduler',
  '/superadmin/config': 'App config',
  '/superadmin/databases': 'Databases',
  '/superadmin/housekeeping': 'Housekeeping',
}

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname]
  if (pathname.startsWith('/superadmin/application/')) return 'App config'
  if (pathname.startsWith('/docs/')) return 'Docs'
  if (pathname.startsWith('/superadmin/')) return 'Superadmin'
  return 'Dashboard'
}

function DashboardLayout() {
  const navigate = useNavigate()
  const { isLoading, isAuthenticated, user } = useAuthSession()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate({ to: '/login', replace: true })
    }
  }, [isLoading, isAuthenticated, navigate])

  if (isLoading || !user) {
    return (
      <div className="flex min-h-svh">
        <div className="hidden w-64 flex-col gap-4 border-r p-4 md:flex">
          <Skeleton className="h-12 w-full" />
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-4 p-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset className="relative overflow-hidden bg-transparent">
        <DashboardBackground />
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur-sm">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>{getPageTitle(pathname)}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  )
}
