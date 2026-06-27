import { Link, useRouterState } from '@tanstack/react-router'
import {
  BookOpen,
  Cog,
  DatabaseZap,
  FileText,
  Gauge,
  LayoutDashboard,
  LayoutGrid,
  ListChecks,
  ReceiptText,
  ScrollText,
  Server,
  Settings,
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
import { m } from '@/paraglide/messages'

const workspaceNav = [
  { title: m.nav_summary, to: '/', icon: LayoutDashboard },
  { title: m.nav_applications, to: '/application', icon: LayoutGrid },
  { title: m.nav_dictionary, to: '/dictionary', icon: BookOpen },
  { title: m.nav_uploads, to: '/uploads', icon: Upload },
  { title: m.nav_transactions, to: '/transactions', icon: ReceiptText },
  { title: m.nav_docs, to: '/docs', icon: FileText },
] as const

const superadminNav = [
  { title: m.nav_users, to: '/superadmin/users', icon: Users },
  { title: m.nav_audit_logs, to: '/superadmin/audit-logs', icon: ScrollText },
  { title: m.nav_processing, to: '/superadmin/processing', icon: Cog },
  { title: m.nav_jobs, to: '/superadmin/jobs', icon: ListChecks },
  { title: m.nav_scheduler, to: '/superadmin/scheduler', icon: Timer },
  { title: m.nav_databases, to: '/superadmin/databases', icon: Server },
  { title: m.nav_index_analyzer, to: '/superadmin/index-analyzer', icon: DatabaseZap },
  { title: m.nav_housekeeping, to: '/superadmin/housekeeping', icon: Trash2 },
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
                  <span className="truncate font-semibold">{m.common_app_name()}</span>
                  <span className="truncate text-xs text-muted-foreground">{m.common_app_tagline()}</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{m.nav_group_workspace()}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {workspaceNav.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.to || (item.to !== '/' && pathname.startsWith(`${item.to}/`))}
                    tooltip={item.title()}
                  >
                    <Link to={item.to}>
                      <item.icon />
                      <span>{item.title()}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {user.role === 'superadmin' && (
          <SidebarGroup>
            <SidebarGroupLabel>{m.nav_group_superadmin()}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {superadminNav.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={pathname === item.to} tooltip={item.title()}>
                      <Link to={item.to}>
                        <item.icon />
                        <span>{item.title()}</span>
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
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === '/settings'} tooltip={m.nav_settings()}>
              <Link to="/settings">
                <Settings />
                <span>{m.nav_settings()}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
