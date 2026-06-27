import { trpc } from '@/router'

export interface SessionUser {
  id: number
  username: string
  role: string
}

interface AuthCheckData {
  authenticated: boolean
  user?: SessionUser
}

export function useAuthSession() {
  const { data, isLoading } = trpc.auth.check.useQuery(undefined, { retry: false })
  const checkData = data?.data as AuthCheckData | undefined
  const isAuthenticated = checkData?.authenticated ?? null
  const user = checkData?.user ?? null
  return { isLoading, isAuthenticated, user }
}
