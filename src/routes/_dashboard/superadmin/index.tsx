import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_dashboard/superadmin/')({
  beforeLoad: () => {
    throw redirect({ to: '/superadmin/users' })
  },
})
