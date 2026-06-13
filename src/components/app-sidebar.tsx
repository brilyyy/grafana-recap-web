import { Link, useRouterState } from '@tanstack/react-router'
import {
  BookOpen,
  Cog,
  Database,
  FileText,
  Gauge,
  LayoutDashboard,
  LayoutGrid,
  ListChecks,
  ReceiptText,
  ScrollText,
  Server,
  Timer,
  Trash2,
  Upload,
  Users,
} from 'lucide-react'
import { NavUser } from '@/components/nav-user'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import type { SessionUser } from '@/hooks/use-auth-session'

const workspaceNav = [
  { title: 'Summary', to: '/', icon: LayoutDashboard },
  { title: 'Applications', to: '/application', icon: LayoutGrid },
  { title: 'Dictionary', to: '/dictionary', icon: BookOpen },
  { title: 'Uploads', to: '/uploads', icon: Upload },
  { title: 'Transactions', to: '/transactions', icon: ReceiptText },
  { title: 'Docs', to: '/docs', icon: FileText },
] as const

const superadminNav = [
  { title: 'Users', to: '/superadmin/users', icon: Users },
  { title: 'Audit logs', to: '/superadmin/audit-logs', icon: ScrollText },
  { title: 'Processing', to: '/superadmin/processing', icon: Cog },
  { title: 'Jobs', to: '/superadmin/jobs', icon: ListChecks },
  { title: 'Scheduler', to: '/superadmin/scheduler', icon: Timer },
  { title: 'Databases', to: '/superadmin/databases', icon: Server },
  { title: 'App config', to: '/superadmin/config', icon: Database },
  { title: 'Housekeeping', to: '/superadmin/housekeeping', icon: Trash2 },
] as const

export function AppSidebar({ user }: { user: SessionUser }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Gauge className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Grafana Recap</span>
                  <span className="truncate text-xs text-muted-foreground">Setup Data</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {workspaceNav.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.to || (item.to !== '/' && pathname.startsWith(`${item.to}/`))}
                    tooltip={item.title}
                  >
                    <Link to={item.to}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {user.role === 'superadmin' && (
          <SidebarGroup>
            <SidebarGroupLabel>Superadmin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {superadminNav.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={pathname === item.to} tooltip={item.title}>
                      <Link to={item.to}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
