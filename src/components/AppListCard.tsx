
import { useEffect } from 'react'
import { useApplications } from '@/hooks/useApplications'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'

export default function AppListCard() {
  const { applications, isLoading, error, refreshApplications } = useApplications()

  useEffect(() => {
    // Listen for app added event
    const handleAppAdded = () => {
      refreshApplications()
    }

    window.addEventListener('appAdded', handleAppAdded)

    return () => {
      window.removeEventListener('appAdded', handleAppAdded)
    }
  }, [refreshApplications])

  const getInitials = (name: string) => {
    if (!name) return '?'
    return name
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('')
  }

  return (
    <div className="bg-card border shadow-xs rounded-xl p-3 md:p-4 h-full flex flex-col transform transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl border border-white/20 will-change-transform" style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
      {/* Icon Header */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <div className="w-8 h-8 rounded-md bg-linear-to-br from-blue-700 to-blue-900 flex items-center justify-center shadow-md shrink-0">
          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <div className="min-w-0">
          <h2 className="text-sm md:text-base font-bold bg-linear-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
            Application List
          </h2>
          <p className="text-xs text-gray-500">Registered apps</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto mb-1.5 border border-gray-200/50 rounded-md bg-white/60 backdrop-blur-sm shadow-inner min-h-0" style={{ maxHeight: 'calc(100vh - 280px)' }}>
        {isLoading ? (
          <div className="p-2 text-center">
            <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent mb-1"></div>
            <p className="text-gray-500 text-xs">Loading...</p>
          </div>
        ) : error ? (
          <div className="p-2 bg-linear-to-r from-red-50 to-rose-50 rounded-md m-1.5 border border-red-200">
            <div className="flex items-start gap-1.5">
              <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-600 text-xs font-semibold break-words whitespace-normal flex-1">Error: {error}</p>
            </div>
          </div>
        ) : applications.length === 0 ? (
          <div className="p-2 text-center">
            <svg className="w-5 h-5 text-gray-400 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="text-gray-500 text-xs">No apps found</p>
          </div>
        ) : (
          <>
            <div className="sticky top-0 bg-linear-to-r from-blue-700 to-blue-900 text-white text-xs font-bold text-center py-1 px-1.5 rounded-t-md backdrop-blur-sm z-10">
              Total: {applications.length}
            </div>
            <ul className="list-none p-0 m-0">
              {applications.map((app, index) => (
                <li
                  key={app.id}
                  className="py-1 px-1.5 border-b border-gray-200/50 last:border-b-0 flex items-center gap-1.5 transition-all duration-200 hover:bg-linear-to-r hover:from-blue-50 hover:to-blue-100 group"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className="w-6 h-6 rounded-md bg-linear-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white font-bold text-xs shadow-xs group-hover:scale-110 transition-transform duration-200 shrink-0">
                    {getInitials(app.app_name)}
                  </div>
                  <span className="font-medium text-xs text-gray-800 group-hover:text-gray-900 flex-1 truncate">
                    {app.app_name}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <Button
        type="button"
        size="sm"
        onClick={() => refreshApplications()}
        className="w-full mt-auto bg-linear-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white text-xs border-0"
      >
        <RefreshCw className="w-3 h-3" />
        Refresh
      </Button>
    </div>
  )
}

