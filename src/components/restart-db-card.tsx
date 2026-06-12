import { useEffect, useState } from 'react'

export default function RestartDbCard() {
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{
    text: string
    type: 'success' | 'error'
  } | null>(null)

  // Auto-hide success message after 8 seconds
  useEffect(() => {
    if (message && message.type === 'success') {
      const timer = setTimeout(() => {
        setMessage(null)
      }, 8000)
      return () => clearTimeout(timer)
    }
  }, [message])

  const handleRestart = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to restart the database? This will delete all existing data and recreate the schema.',
    )

    if (!confirmed) return

    try {
      setIsLoading(true)
      setMessage(null)

      const response = await fetch('/api/restart-db', {
        method: 'POST',
      })

      const result = await response.json()

      if (result.success) {
        setMessage({
          text: result.message,
          type: 'success',
        })

        // Dispatch event to refresh app list
        window.dispatchEvent(new CustomEvent('appAdded'))
      } else {
        setMessage({
          text: result.message || 'Failed to restart database',
          type: 'error',
        })
      }
    } catch (error) {
      console.error('Error restarting database:', error)
      setMessage({
        text: 'Error connecting to server',
        type: 'error',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-card border shadow-xs rounded-xl p-3 md:p-4 h-full flex flex-col transform transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl border border-white/20">
      {/* Icon Header */}
      <div className="flex items-center gap-1.5 mb-2">
        <div className="w-8 h-8 rounded-md bg-linear-to-br from-red-600 to-red-800 flex items-center justify-center shadow-md shrink-0">
          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </div>
        <div className="min-w-0">
          <h2 className="text-sm md:text-base font-bold bg-linear-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
            Restart Database
          </h2>
          <p className="text-xs text-gray-500">Reset schema & tables</p>
        </div>
      </div>

      {message && (
        <div
          className={`mb-2 p-2 rounded-md text-xs font-medium shadow-md transform transition-all animate-in slide-in-from-bottom-5 duration-300 ${
            message.type === 'success'
              ? 'bg-linear-to-r from-green-50 to-emerald-50 text-green-800 border border-green-200'
              : 'bg-linear-to-r from-red-50 to-rose-50 text-red-800 border border-red-200'
          }`}
        >
          <div className={`flex gap-1.5 ${message.type === 'error' ? 'items-start' : 'items-center'}`}>
            {message.type === 'success' ? (
              <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            <span className={`flex-1 ${message.type === 'error' ? 'break-words whitespace-normal' : 'truncate'}`}>
              {message.text}
            </span>
          </div>
        </div>
      )}

      <div className="mb-2 p-2 bg-linear-to-r from-yellow-50 via-orange-50 to-red-50 border border-yellow-300 rounded-md shadow-xs flex-1 flex items-center min-h-0">
        <div className="flex items-start gap-1.5">
          <svg
            className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div className="min-w-0">
            <p className="text-xs font-bold text-yellow-800 mb-0.5">⚠️ Warning: Destructive Action</p>
            <p className="text-xs text-yellow-700 leading-tight">
              This will delete all existing data and recreate the database schema.
            </p>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleRestart}
        disabled={isLoading}
        className="w-full px-2.5 py-1.5 rounded-md font-semibold text-xs transition-all duration-300 bg-linear-to-r from-red-600 via-red-700 to-red-800 text-white hover:from-red-700 hover:via-red-800 hover:to-red-900 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 relative overflow-hidden group mt-auto"
      >
        <span className="relative z-10 flex items-center justify-center gap-1.5">
          {isLoading ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Restarting...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Restart DB
            </>
          )}
        </span>
        <div className="absolute inset-0 bg-white/20 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300" />
      </button>
    </div>
  )
}
