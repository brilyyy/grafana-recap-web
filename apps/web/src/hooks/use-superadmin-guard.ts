import { useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useAuthSession } from '@/hooks/use-auth-session'

/**
 * Redirects non-superadmin users to the home page. The dashboard layout
 * already guarantees authentication; this only adds the role check.
 */
export function useSuperadminGuard() {
  const navigate = useNavigate()
  const { isLoading, user } = useAuthSession()

  useEffect(() => {
    if (!isLoading && user && user.role !== 'superadmin') {
      navigate({ to: '/', replace: true })
    }
  }, [isLoading, user, navigate])

  return { isLoading, isSuperadmin: user?.role === 'superadmin' }
}