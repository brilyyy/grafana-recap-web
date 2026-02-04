'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AddAppCard from '@/components/AddAppCard'
import AppListCard from '@/components/AppListCard'
import DictionaryUploadCard from '@/components/DictionaryUploadCard'
import AddSuccessRateCard from '@/components/AddSuccessRateCard'
import UnmappedRcCard from '@/components/UnmappedRcCard'
import NoRcTransactionCard from '@/components/NoRcTransactionCard'
import DictionaryCard from '@/components/DictionaryCard'
import LogoutButton from '@/components/LogoutButton'

export default function Home() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/check')
        if (!isMounted) return
        
        const data = await response.json()
        
        if (data.success && data.data.authenticated) {
          setIsAuthenticated(true)
          setUserRole(data.data.user.role)
        } else {
          // Not authenticated, redirect to login
          router.replace('/login')
        }
      } catch (error) {
        if (!isMounted) return
        // Error checking auth, redirect to login
        router.replace('/login')
      }
    }
    
    checkAuth()
    
    return () => {
      isMounted = false
    }
  }, []) // Remove router from dependencies

  // Show loading state while checking authentication
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // If not authenticated, don't render (redirect will happen)
  if (!isAuthenticated) {
    return null
  }

  return (
    <main className="min-h-screen p-2 md:p-4 lg:p-5">
      {/* Header with gradient text and logout button */}
      <div className="flex flex-col items-center justify-center mb-3 md:mb-4 gap-3 md:gap-4 animate-fade-in">
        <div className="flex-1 text-center">
        <h1 className="text-xl md:text-2xl lg:text-3xl font-extrabold mb-1 bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-200 to-red-200 drop-shadow-lg">
          Setup Data Grafana
        </h1>
        <p className="text-white/90 text-xs md:text-sm font-medium">
          Manage your application data with ease
        </p>
        </div>
        <div className="w-full flex justify-center gap-2">
          {userRole === 'superadmin' && (
            <button
              onClick={() => router.push('/user-approval')}
              className="flex items-center gap-2 px-3 md:px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white font-semibold rounded-lg transition-all shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95 border border-purple-400/30"
              title="User Approval"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>User Approval</span>
            </button>
          )}
          <LogoutButton />
        </div>
      </div>

      {/* Bento Box Grid Layout */}
      <div className="max-w-7xl mx-auto">
        <div className="hidden lg:grid lg:grid-cols-12 gap-2 lg:gap-3" style={{ gridTemplateRows: 'repeat(6, minmax(140px, auto))' }}>
          <div className="lg:col-span-2 lg:row-span-2 lg:row-start-1 animate-fade-in bento-item" style={{ animationDelay: '0.1s' }}>
            <AppListCard />
          </div>

          <div className="lg:col-span-2 lg:row-span-2 lg:row-start-1 animate-fade-in bento-item" style={{ animationDelay: '0.2s' }}>
            <AddAppCard />
          </div>

          <div className="lg:col-span-8 lg:row-span-2 lg:row-start-1 animate-fade-in bento-item" style={{ animationDelay: '0.15s' }}>
            <UnmappedRcCard />
          </div>

          {/* Row 3, 4, 5: 3 card vertikal di kiri, No RC Transaction di kanan */}
          {/* Dictionary Upload Card - Top left (Row 3, cols 1-4) */}
          <div className="lg:col-span-4 lg:col-start-1 lg:row-start-3 lg:row-span-1 animate-fade-in bento-item" style={{ animationDelay: '0.3s' }}>
            <DictionaryUploadCard />
          </div>

          {/* Add Success Rate Card - Middle left (Row 4, cols 1-4) */}
          <div className="lg:col-span-4 lg:col-start-1 lg:row-start-4 lg:row-span-1 animate-fade-in bento-item flex items-start w-full min-w-0" style={{ animationDelay: '0.4s' }}>
            <AddSuccessRateCard />
          </div>

          {/* No RC Transaction Card - Wide rectangle di kanan (spans rows 3-5, cols 5-12) */}
          <div className="lg:col-span-8 lg:col-start-5 lg:row-span-2 lg:row-start-3 animate-fade-in bento-item" style={{ animationDelay: '0.2s' }}>
            <NoRcTransactionCard />
          </div>

          <div className="lg:col-span-12 lg:row-start-5 lg:row-span-2 animate-fade-in bento-item" style={{ animationDelay: '0.7s' }}>
            <DictionaryCard />
          </div>
        </div>

        {/* Tablet Layout - 4 rows */}
        <div className="hidden md:grid lg:hidden md:grid-cols-6 gap-2 md:gap-3" style={{ gridTemplateRows: 'repeat(4, minmax(140px, auto))' }}>
          {/* App List Card - Left side (spans 3 rows) */}
          <div className="md:col-span-2 md:row-span-3 animate-fade-in bento-item" style={{ animationDelay: '0.1s' }}>
            <AppListCard />
          </div>

          {/* Add App Card - Compact */}
          <div className="md:col-span-1 md:row-span-1 animate-fade-in bento-item" style={{ animationDelay: '0.2s' }}>
            <AddAppCard />
          </div>

          {/* Dictionary Upload Card */}
          <div className="md:col-span-3 md:row-span-1 animate-fade-in bento-item" style={{ animationDelay: '0.3s' }}>
            <DictionaryUploadCard />
          </div>

          {/* Add Success Rate Card */}
          <div className="md:col-span-2 md:row-span-1 animate-fade-in bento-item" style={{ animationDelay: '0.4s' }}>
            <AddSuccessRateCard />
          </div>

          {/* Unmapped RC Card - Wide rectangle */}
          <div className="md:col-span-4 md:row-span-2 animate-fade-in bento-item" style={{ animationDelay: '0.5s' }}>
            <UnmappedRcCard />
          </div>

          {/* No RC Transaction Card - Wide rectangle */}
          <div className="md:col-span-4 md:row-span-2 animate-fade-in bento-item" style={{ animationDelay: '0.7s' }}>
            <NoRcTransactionCard />
          </div>

          {/* Dictionary Card - Full width at bottom */}
          <div className="md:col-span-6 md:row-span-1 animate-fade-in bento-item" style={{ animationDelay: '0.8s' }}>
            <DictionaryCard />
          </div>
        </div>

        {/* Mobile Layout - Stack vertical */}
        <div className="grid grid-cols-1 gap-3 md:hidden">
          <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <AppListCard />
          </div>
          <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <UnmappedRcCard />
          </div>
          <div className="animate-fade-in" style={{ animationDelay: '0.25s' }}>
            <NoRcTransactionCard />
          </div>
          <div className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <AddAppCard />
          </div>
          <div className="animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <DictionaryUploadCard />
          </div>
          <div className="animate-fade-in" style={{ animationDelay: '0.5s' }}>
            <AddSuccessRateCard />
          </div>
          <div className="animate-fade-in" style={{ animationDelay: '0.6s' }}>
            <DictionaryCard />
          </div>
        </div>
      </div>
    </main>
  )
}

