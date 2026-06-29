import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/i18n-format'

export function formatDate(dateString: string) {
  return formatDateTime(dateString)
}

export function RoleBadge({ role }: { role: string }) {
  switch (role) {
    case 'superadmin':
      return <Badge>superadmin</Badge>
    case 'admin':
      return <Badge variant="secondary">admin</Badge>
    default:
      return <Badge variant="outline">{role}</Badge>
  }
}
