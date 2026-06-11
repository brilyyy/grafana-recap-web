import { useState } from 'react'
import { trpc } from '@/router'

export default function AddAppCard() {
  const [appName, setAppName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{
    text: string
    type: 'success' | 'error'
  } | null>(null)

  const createAppMutation = trpc.applications.create.useMutation()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!appName.trim()) return

    try {
      setIsLoading(true)
      setMessage(null)

      const result = await createAppMutation.mutateAsync({ app_name: appName.trim() })

      if (result.success) {
        setMessage({
          text: `Application "${appName}" has been added successfully!`,
          type: 'success',
        })
        setAppName('')

        // Dispatch event for app list refresh
        window.dispatchEvent(new CustomEvent('appAdded'))

        // Auto hide success message after 5 seconds
        setTimeout(() => setMessage(null), 5000)
      } else {
        setMessage({
          text: result.message || 'Failed to add application',
          type: 'error',
        })
      }
    } catch (error: any) {
      console.error('Error adding application:', error)
      setMessage({
        text: error?.message || 'Failed to add application',
        type: 'error',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-card border shadow-xs rounded-xl p-3 md:p-4 h-full flex flex-col transform transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl border border-white/20">
      {/* Icon Header */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <div className="w-8 h-8 rounded-md bg-linear-to-br from-blue-600 to-blue-800 flex items-center justify-center shadow-md shrink-0">
          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <div className="min-w-0">
          <h2 className="text-sm md:text-base font-bold bg-linear-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent truncate">
            Add New App
          </h2>
          <p className="text-xs text-gray-500">Create application</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
        <label htmlFor="appName" className="block mb-1 font-semibold text-xs text-gray-700">
          Application Name
        </label>
        <div className="relative mb-1.5 flex-1 min-h-0">
          <input
            type="text"
            id="appName"
            name="appName"
            value={appName}
            onChange={(e) => setAppName(e.target.value)}
            placeholder="Enter name"
            required
            className="w-full px-2 py-1.5 border-2 border-gray-200 rounded-md text-xs focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-all bg-white/80 backdrop-blur-sm"
          />
        </div>

        {message && (
          <div
            className={`mb-1.5 p-1.5 rounded-md text-xs font-medium shadow-md transform transition-all animate-in slide-in-from-bottom-5 duration-300 ${
              message.type === 'success'
                ? 'bg-linear-to-r from-green-50 to-emerald-50 text-green-800 border border-green-200'
                : 'bg-linear-to-r from-red-50 to-rose-50 text-red-800 border border-red-200'
            }`}
          >
            <div className={`flex gap-1 ${message.type === 'error' ? 'items-start' : 'items-center'}`}>
              {message.type === 'success' ? (
                <svg className="w-3 h-3 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg className="w-3 h-3 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
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

        <button
          type="submit"
          disabled={isLoading}
          className="w-full px-2.5 py-1.5 rounded-md font-semibold text-xs transition-all duration-300 bg-linear-to-r from-blue-600 to-blue-800 text-white hover:from-blue-700 hover:to-blue-900 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-1 mt-auto"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Adding...
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add App
            </>
          )}
        </button>
      </form>
    </div>
  )
}
