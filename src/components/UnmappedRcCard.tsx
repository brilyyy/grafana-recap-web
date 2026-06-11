
import { useState, useEffect, useCallback } from 'react'
import type { UnmappedRC } from '@/types'
import { useApplications } from '@/hooks/useApplications'
import { trpc } from '@/router'

export default function UnmappedRcCard() {
  const [unmappedRcs, setUnmappedRcs] = useState<UnmappedRC[]>([])
  const { applications } = useApplications()
  const [selectedAppId, setSelectedAppId] = useState<string>('')
  const [selectedErrorTypes, setSelectedErrorTypes] = useState<Record<number, 'S' | 'N' | 'Sukses'>>({})
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState<number | null>(null)
  const [submittingAll, setSubmittingAll] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const utils = trpc.useUtils()
  const submitMutation = trpc.unmappedRc.submit.useMutation()
  const submitBatchMutation = trpc.unmappedRc.submitBatch.useMutation()

  const loadUnmappedRcs = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const result = await utils.unmappedRc.list.fetch(
        {
          fetch_all: true,
          ...(selectedAppId ? { app_id: parseInt(selectedAppId) } : {}),
        },
        { staleTime: 0 }
      )

      if (result.success) {
        setUnmappedRcs(result.data.entries as UnmappedRC[])
        // Reset selections when data reloads
        setSelectedItems(new Set())
        setSelectedErrorTypes({})
      } else {
        throw new Error('Failed to load unmapped RCs')
      }
    } catch (err: any) {
      setError(err.message)
      console.error('Error loading unmapped RCs:', err)
    } finally {
      setIsLoading(false)
    }
  }, [selectedAppId, utils])

  // Applications loaded via useApplications hook

  useEffect(() => {
    loadUnmappedRcs()

    // Listen for data changes
    const handleDataChange = () => {
      loadUnmappedRcs()
    }

    window.addEventListener('successRateUploaded', handleDataChange)
    window.addEventListener('dictionaryUploaded', handleDataChange)
    window.addEventListener('appAdded', handleDataChange)

    return () => {
      window.removeEventListener('successRateUploaded', handleDataChange)
      window.removeEventListener('dictionaryUploaded', handleDataChange)
      window.removeEventListener('appAdded', handleDataChange)
    }
  }, [loadUnmappedRcs])

  // Auto-hide success message after 8 seconds
  useEffect(() => {
    if (message && message.type === 'success') {
      const timer = setTimeout(() => {
        setMessage(null)
      }, 8000)
      return () => clearTimeout(timer)
    }
  }, [message])

  const handleErrorTypeChange = (id: number, value: 'S' | 'N' | 'Sukses') => {
    setSelectedErrorTypes(prev => ({
      ...prev,
      [id]: value
    }))
    // Auto-select item when error type is chosen
    setSelectedItems(prev => new Set(prev).add(id))
  }

  const handleSelectItem = (id: number) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const handleSelectAll = () => {
    if (selectedItems.size === unmappedRcs.length) {
      // Deselect all
      setSelectedItems(new Set())
    } else {
      // Select all
      setSelectedItems(new Set(unmappedRcs.map(rc => rc.id)))
    }
  }

  const handleSubmitAll = async () => {
    const itemsToSubmit = unmappedRcs.filter(rc => 
      selectedItems.has(rc.id) && selectedErrorTypes[rc.id]
    )

    if (itemsToSubmit.length === 0) {
      setMessage({ text: 'Please select at least one RC with an error type', type: 'error' })
      return
    }

    try {
      setSubmittingAll(true)
      setMessage(null)

      const mappings = itemsToSubmit.map(rc => ({
        id: rc.id,
        id_app_identifier: rc.id_app_identifier,
        jenis_transaksi: rc.jenis_transaksi,
        rc: rc.rc ?? '',
        error_type: selectedErrorTypes[rc.id],
      }))

      const result = await submitBatchMutation.mutateAsync({ items: mappings })

      if (result.success) {
        setMessage({
          text: result.message || `Successfully mapped ${itemsToSubmit.length} RC(s)`,
          type: 'success'
        })
        // Remove submitted items from local state
        const submittedIds = new Set(itemsToSubmit.map(rc => rc.id))
        setUnmappedRcs(prev => prev.filter(item => !submittedIds.has(item.id)))
        // Clear selections
        setSelectedItems(new Set())
        setSelectedErrorTypes(prev => {
          const newState = { ...prev }
          itemsToSubmit.forEach(rc => {
            delete newState[rc.id]
          })
          return newState
        })
        // Dispatch event to notify other components
        window.dispatchEvent(new CustomEvent('unmappedRcSubmitted'))
      } else {
        throw new Error(result.message || 'Failed to submit mappings')
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' })
    } finally {
      setSubmittingAll(false)
    }
  }

  const handleSubmit = async (rc: UnmappedRC) => {
    const errorType = selectedErrorTypes[rc.id]
    
    if (!errorType) {
      setMessage({ text: 'Please select an error type (S/N/Sukses)', type: 'error' })
      return
    }

    try {
      setSubmitting(rc.id)
      setMessage(null)

      const result = await submitMutation.mutateAsync({
        id: rc.id,
        id_app_identifier: rc.id_app_identifier,
        jenis_transaksi: rc.jenis_transaksi,
        rc: rc.rc ?? '',
        error_type: errorType,
      })

      if (result.success) {
        setMessage({ text: result.message, type: 'success' })
        // Remove from local state
        setUnmappedRcs(prev => prev.filter(item => item.id !== rc.id))
        // Remove from selected error types and selected items
        setSelectedErrorTypes(prev => {
          const newState = { ...prev }
          delete newState[rc.id]
          return newState
        })
        setSelectedItems(prev => {
          const newSet = new Set(prev)
          newSet.delete(rc.id)
          return newSet
        })
        // Dispatch event to notify other components
        window.dispatchEvent(new CustomEvent('unmappedRcSubmitted'))
      } else {
        throw new Error(result.message || 'Failed to submit mapping')
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' })
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <div className="bg-card border shadow-xs rounded-xl p-3 md:p-4 h-full flex flex-col border border-white/20">
      {/* Icon Header */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <div className="w-8 h-8 rounded-md bg-linear-to-br from-orange-600 to-orange-800 flex items-center justify-center shadow-md shrink-0">
          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className="min-w-0">
          <h2 className="text-sm md:text-base font-bold bg-linear-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
            Unmapped RC
          </h2>
          <p className="text-xs text-gray-500">RC belum dimapping</p>
        </div>
      </div>

      {/* Filter */}
      <div className="mb-1.5">
        <select
          value={selectedAppId}
          onChange={(e) => setSelectedAppId(e.target.value)}
          className="w-full px-2.5 py-1.5 border-2 border-gray-200 rounded-md text-sm focus:outline-hidden focus:border-orange-500 focus:ring-1 focus:ring-orange-200 transition-all bg-white/80 backdrop-blur-sm"
        >
          <option value="">All Applications</option>
          {applications.map((app) => (
            <option key={app.id} value={app.id}>
              {app.app_name}
            </option>
          ))}
        </select>
      </div>

      {message && (
        <div
          className={`mb-1.5 p-2 rounded-md text-xs font-medium shadow-md transform transition-all animate-in slide-in-from-bottom-5 duration-300 ${
            message.type === 'success'
              ? 'bg-linear-to-r from-green-50 to-emerald-50 text-green-800 border border-green-200'
              : 'bg-linear-to-r from-red-50 to-rose-50 text-red-800 border border-red-200'
          }`}
        >
          <div className={`flex gap-1.5 ${message.type === 'error' ? 'items-start' : 'items-center'}`}>
            {message.type === 'success' ? (
              <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            )}
            <span className={`flex-1 ${message.type === 'error' ? 'break-words whitespace-normal' : 'truncate'}`}>{message.text}</span>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto mb-1.5 border border-gray-200/50 rounded-md bg-white/60 backdrop-blur-sm shadow-inner min-h-0 max-h-[500px]">
        {isLoading ? (
          <div className="p-2 text-center">
            <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-orange-500 border-t-transparent mb-1"></div>
            <p className="text-gray-500 text-xs">Loading...</p>
          </div>
        ) : error ? (
          <div className="p-2 text-center bg-linear-to-r from-red-50 to-rose-50 rounded-md m-1.5 border border-red-200">
            <svg className="w-4 h-4 text-red-500 mx-auto mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-600 text-xs font-semibold">Error: {error}</p>
          </div>
        ) : unmappedRcs.length === 0 ? (
          <div className="p-3 text-center">
            <svg className="w-6 h-6 text-green-500 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-gray-500 text-xs">Semua RC sudah dimapping</p>
          </div>
        ) : (
          <>
            <div className="sticky top-0 bg-linear-to-r from-orange-600 to-orange-800 text-white text-xs font-bold py-1 px-1.5 rounded-t-md backdrop-blur-sm z-10">
              <div className="flex items-center justify-between">
                <span>Total: {unmappedRcs.length} RC belum dimapping</span>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 cursor-pointer text-xs font-normal">
                    <input
                      type="checkbox"
                      checked={selectedItems.size === unmappedRcs.length && unmappedRcs.length > 0}
                      onChange={handleSelectAll}
                      className="w-3 h-3 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                    />
                    <span>Select All</span>
                  </label>
                  {selectedItems.size > 0 && (
                    <button
                      type="button"
                      onClick={handleSubmitAll}
                      disabled={submittingAll || unmappedRcs.filter(rc => selectedItems.has(rc.id) && selectedErrorTypes[rc.id]).length === 0}
                      className="px-2 py-0.5 rounded text-xs font-semibold transition-all duration-300 bg-white text-orange-700 hover:bg-orange-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      {submittingAll ? (
                        <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      ) : (
                        <>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Submit All ({unmappedRcs.filter(rc => selectedItems.has(rc.id) && selectedErrorTypes[rc.id]).length})
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
            <ul className="list-none p-0 m-0">
              {unmappedRcs.map((rc) => (
                <li
                  key={rc.id}
                  className={`py-2 px-2 border-b border-gray-200/50 last:border-b-0 transition-all duration-200 ${
                    selectedItems.has(rc.id) 
                      ? 'bg-linear-to-r from-orange-100 to-orange-50' 
                      : 'hover:bg-linear-to-r hover:from-orange-50 hover:to-orange-100'
                  }`}
                >
                  <div className="flex flex-col gap-1.5">
                    {/* RC Info with Checkbox */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={selectedItems.has(rc.id)}
                          onChange={() => handleSelectItem(rc.id)}
                          className="w-3.5 h-3.5 rounded border-gray-300 text-orange-600 focus:ring-orange-500 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded">
                              {rc.app_name}
                            </span>
                            <span className="text-xs font-mono font-bold text-gray-800">
                              RC: {rc.rc}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 truncate mt-0.5">
                            {rc.jenis_transaksi || 'N/A'} • {rc.rc_description || 'No description'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Enhanced Radio Buttons & Submit */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        {(['S', 'N', 'Sukses'] as const).map((value) => {
                          const isSelected = selectedErrorTypes[rc.id] === value
                          const colorClasses = {
                            'S': {
                              bg: isSelected ? 'bg-blue-500' : 'bg-blue-50',
                              text: isSelected ? 'text-white' : 'text-blue-700',
                              border: isSelected ? 'border-blue-600' : 'border-blue-300',
                              hover: 'hover:bg-blue-100 hover:border-blue-400'
                            },
                            'N': {
                              bg: isSelected ? 'bg-red-500' : 'bg-red-50',
                              text: isSelected ? 'text-white' : 'text-red-700',
                              border: isSelected ? 'border-red-600' : 'border-red-300',
                              hover: 'hover:bg-red-100 hover:border-red-400'
                            },
                            'Sukses': {
                              bg: isSelected ? 'bg-green-500' : 'bg-green-50',
                              text: isSelected ? 'text-white' : 'text-green-700',
                              border: isSelected ? 'border-green-600' : 'border-green-300',
                              hover: 'hover:bg-green-100 hover:border-green-400'
                            }
                          }
                          const colors = colorClasses[value]
                          
                          return (
                            <label
                              key={value}
                              className={`flex items-center justify-center gap-1.5 cursor-pointer px-3 py-1.5 rounded-lg border-2 transition-all duration-200 font-semibold text-xs min-w-[60px] ${
                                colors.bg
                              } ${colors.text} ${colors.border} ${colors.hover} ${
                                isSelected ? 'shadow-md scale-105' : 'shadow-xs'
                              }`}
                            >
                              <input
                                type="radio"
                                name={`error_type_${rc.id}`}
                                value={value}
                                checked={isSelected}
                                onChange={() => handleErrorTypeChange(rc.id, value)}
                                className="sr-only"
                              />
                              <span className="font-bold">{value}</span>
                              {isSelected && (
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </label>
                          )
                        })}
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => handleSubmit(rc)}
                        disabled={!selectedErrorTypes[rc.id] || submitting === rc.id || submittingAll}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 bg-linear-to-r from-orange-500 to-orange-700 text-white hover:from-orange-600 hover:to-orange-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 shadow-xs hover:shadow-md"
                      >
                        {submitting === rc.id ? (
                          <>
                            <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                          </>
                        ) : (
                          <>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Submit
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={loadUnmappedRcs}
        className="w-full px-2.5 py-1.5 rounded-md font-semibold text-xs transition-all duration-300 bg-linear-to-r from-orange-500 to-orange-700 text-white hover:from-orange-600 hover:to-orange-800 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-1"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Refresh
      </button>
    </div>
  )
}

