import { createFileRoute, redirect } from '@tanstack/react-router'

// Unmapped RC now lives on the Dictionary page; keep old bookmarks working.
export const Route = createFileRoute('/_dashboard/unmapped-rc')({
  beforeLoad: () => {
    throw redirect({ to: '/dictionary' })
  },
})
