
import { trpc } from '@/router'
import type { Application } from '@/types'

/**
 * Hook to load applications via tRPC (replaces fetch('/api/applications')).
 * TanStack Query handles caching, deduplication, and revalidation automatically.
 */
export function useApplications() {
  const { data, isLoading, error, refetch } = trpc.applications.list.useQuery(undefined, {
    staleTime: 60 * 1000, // 1 minute
  })

  const applications: Application[] = (data?.data?.applications ?? []) as Application[]

  return {
    applications,
    isLoading,
    error: error?.message ?? null,
    refreshApplications: refetch,
  }
}
