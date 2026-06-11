import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import AddAppCard from '@/components/AddAppCard'
import AppListCard from '@/components/AppListCard'
import DictionaryUploadCard from '@/components/DictionaryUploadCard'
import AddSuccessRateCard from '@/components/AddSuccessRateCard'
import UnmappedRcCard from '@/components/UnmappedRcCard'
import NoRcTransactionCard from '@/components/NoRcTransactionCard'
import DictionaryCard from '@/components/DictionaryCard'
import LogoutButton from '@/components/LogoutButton'
import { trpc } from '@/router'
import { Button } from '@/components/ui/button'
import { Settings } from 'lucide-react'

export const Route = createFileRoute('/')({
  ssr: false,
  component: Home,
})

function Home() {
  const navigate = useNavigate()
  const { data: authCheck, isLoading: authLoading } = trpc.auth.check.useQuery(undefined, { retry: false })
  const isAuthenticated = authCheck?.data?.authenticated ?? null
  const userRole = (authCheck?.data as any)?.user?.role ?? null

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate({ to: '/login', replace: true })
    }
  }, [isAuthenticated, authLoading, navigate])

  // Show loading state while checking authentication
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-white/70">Loading...</p>
        </div>
      </div>
    )
  }

  // If not authenticated, don't render (redirect will happen)
  if (authLoading || !isAuthenticated) {
    return null
  }

  return (
    <main className="min-h-screen p-2 md:p-4 lg:p-5">
      {/* Header with gradient text and logout button */}
      <div className="flex flex-col items-center justify-center mb-3 md:mb-4 gap-3 md:gap-4 animate-in fade-in duration-300">
        <div className="flex-1 text-center">
        <h1 className="text-xl md:text-2xl lg:text-3xl font-extrabold mb-1 bg-clip-text text-transparent bg-linear-to-r from-white via-blue-200 to-red-200 drop-shadow-lg">
          Setup Data Grafana
        </h1>
        <p className="text-white/90 text-xs md:text-sm font-medium">
          Manage your application data with ease
        </p>
        </div>
        <div className="w-full flex justify-center gap-2">
          {userRole === 'superadmin' && (
            <Button
              onClick={() => navigate({ to: '/superadmin' })}
              size="sm"
              title="Superadmin Dashboard"
              className="bg-linear-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white border-purple-400/30"
            >
              <Settings className="w-4 h-4" />
              <span>Superadmin</span>
            </Button>
          )}
          <LogoutButton />
        </div>
      </div>

      {/* Bento Box Grid Layout */}
      <div className="max-w-7xl mx-auto">
        <div className="hidden lg:grid lg:grid-cols-12 gap-2 lg:gap-3" style={{ gridTemplateRows: 'repeat(6, minmax(140px, auto))' }}>
          <div className="lg:col-span-2 lg:row-span-2 lg:row-start-1 animate-in fade-in duration-300 h-full flex flex-col" style={{ animationDelay: '0.1s' }}>
            <AppListCard />
          </div>

          <div className="lg:col-span-2 lg:row-span-2 lg:row-start-1 animate-in fade-in duration-300 h-full flex flex-col" style={{ animationDelay: '0.2s' }}>
            <AddAppCard />
          </div>

          <div className="lg:col-span-8 lg:row-span-2 lg:row-start-1 animate-in fade-in duration-300 h-full flex flex-col" style={{ animationDelay: '0.15s' }}>
            <UnmappedRcCard />
          </div>

          {/* Row 3, 4, 5: 3 card vertikal di kiri, No RC Transaction di kanan */}
          {/* Dictionary Upload Card - Top left (Row 3, cols 1-4) */}
          <div className="lg:col-span-4 lg:col-start-1 lg:row-start-3 lg:row-span-1 animate-in fade-in duration-300 h-full flex flex-col" style={{ animationDelay: '0.3s' }}>
            <DictionaryUploadCard />
          </div>

          {/* Add Success Rate Card - Middle left (Row 4, cols 1-4) */}
          <div className="lg:col-span-4 lg:col-start-1 lg:row-start-4 lg:row-span-1 animate-in fade-in duration-300 h-full flex flex-col flex items-start w-full min-w-0" style={{ animationDelay: '0.4s' }}>
            <AddSuccessRateCard />
          </div>

          {/* No RC Transaction Card - Wide rectangle di kanan (spans rows 3-5, cols 5-12) */}
          <div className="lg:col-span-8 lg:col-start-5 lg:row-span-2 lg:row-start-3 animate-in fade-in duration-300 h-full flex flex-col" style={{ animationDelay: '0.2s' }}>
            <NoRcTransactionCard />
          </div>

          <div className="lg:col-span-12 lg:row-start-5 lg:row-span-2 animate-in fade-in duration-300 h-full flex flex-col" style={{ animationDelay: '0.7s' }}>
            <DictionaryCard />
          </div>
        </div>

        {/* Tablet Layout - 4 rows */}
        <div className="hidden md:grid lg:hidden md:grid-cols-6 gap-2 md:gap-3" style={{ gridTemplateRows: 'repeat(4, minmax(140px, auto))' }}>
          {/* App List Card - Left side (spans 3 rows) */}
          <div className="md:col-span-2 md:row-span-3 animate-in fade-in duration-300 h-full flex flex-col" style={{ animationDelay: '0.1s' }}>
            <AppListCard />
          </div>

          {/* Add App Card - Compact */}
          <div className="md:col-span-1 md:row-span-1 animate-in fade-in duration-300 h-full flex flex-col" style={{ animationDelay: '0.2s' }}>
            <AddAppCard />
          </div>

          {/* Dictionary Upload Card */}
          <div className="md:col-span-3 md:row-span-1 animate-in fade-in duration-300 h-full flex flex-col" style={{ animationDelay: '0.3s' }}>
            <DictionaryUploadCard />
          </div>

          {/* Add Success Rate Card */}
          <div className="md:col-span-2 md:row-span-1 animate-in fade-in duration-300 h-full flex flex-col" style={{ animationDelay: '0.4s' }}>
            <AddSuccessRateCard />
          </div>

          {/* Unmapped RC Card - Wide rectangle */}
          <div className="md:col-span-4 md:row-span-2 animate-in fade-in duration-300 h-full flex flex-col" style={{ animationDelay: '0.5s' }}>
            <UnmappedRcCard />
          </div>

          {/* No RC Transaction Card - Wide rectangle */}
          <div className="md:col-span-4 md:row-span-2 animate-in fade-in duration-300 h-full flex flex-col" style={{ animationDelay: '0.7s' }}>
            <NoRcTransactionCard />
          </div>

          {/* Dictionary Card - Full width at bottom */}
          <div className="md:col-span-6 md:row-span-1 animate-in fade-in duration-300 h-full flex flex-col" style={{ animationDelay: '0.8s' }}>
            <DictionaryCard />
          </div>
        </div>

        {/* Mobile Layout - Stack vertical */}
        <div className="grid grid-cols-1 gap-3 md:hidden">
          <div className="animate-in fade-in duration-300" style={{ animationDelay: '0.1s' }}>
            <AppListCard />
          </div>
          <div className="animate-in fade-in duration-300" style={{ animationDelay: '0.2s' }}>
            <UnmappedRcCard />
          </div>
          <div className="animate-in fade-in duration-300" style={{ animationDelay: '0.25s' }}>
            <NoRcTransactionCard />
          </div>
          <div className="animate-in fade-in duration-300" style={{ animationDelay: '0.3s' }}>
            <AddAppCard />
          </div>
          <div className="animate-in fade-in duration-300" style={{ animationDelay: '0.4s' }}>
            <DictionaryUploadCard />
          </div>
          <div className="animate-in fade-in duration-300" style={{ animationDelay: '0.5s' }}>
            <AddSuccessRateCard />
          </div>
          <div className="animate-in fade-in duration-300" style={{ animationDelay: '0.6s' }}>
            <DictionaryCard />
          </div>
        </div>
      </div>
    </main>
  )
}
