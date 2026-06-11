'use client'

import { useState, useEffect, useCallback } from 'react'
import type { SuccessRateEntry } from '@/types'
import { useApplications } from '@/hooks/useApplications'
import { trpc } from '@/lib/trpc'

export default function NoRcTransactionCard() {
  const [transactions, setTransactions] = useState<SuccessRateEntry[]>([])
  const { applications } = useApplications()
  const [selectedAppId, setSelectedAppId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())
  const [editingRc, setEditingRc] = useState<Record<number, string>>({})
  const [editingRcDescription, setEditingRcDescription] = useState<Record<number, string>>({})
  const [bulkRc, setBulkRc] = useState<string>('')
  const [bulkRcDescription, setBulkRcDescription] = useState<string>('')
  const [submitting, setSubmitting] = useState<number | null>(null)
  const [submittingAll, setSubmittingAll] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [limit, setLimit] = useState(25)
  const ROW_COUNT_OPTIONS = [25, 50, 100] as const

  const utils = trpc.useUtils()
  const submitMutation = trpc.noRcTransaction.submit.useMutation()
  const submitBatchMutation = trpc.noRcTransaction.submitBatch.useMutation()

  const loadTransactions = useCallback(async (page: number) => {
    try {
      setIsLoading(true)
      setError(null)

      const result = await utils.noRcTransaction.list.fetch(
        {
          page,
          limit,
          ...(selectedAppId ? { app_id: parseInt(selectedAppId) } : {}),
        },
        { staleTime: 0 }
      )

      if (result.success) {
        setTransactions(result.data.entries as SuccessRateEntry[])
        setTotalPages(Math.ceil((result.data.total || 0) / limit) || 1)
        setTotalCount(result.data.total || 0)
        // Reset selections when data reloads
        setSelectedItems(new Set())
        setEditingRc({})
        setEditingRcDescription({})
      } else {
        throw new Error('Failed to load no RC transactions')
      }
    } catch (err: any) {
      setError(err.message)
      console.error('Error loading no RC transactions:', err)
    } finally {
      setIsLoading(false)
    }
  }, [selectedAppId, limit, utils])

  // Applications loaded via useApplications hook

  useEffect(() => {
    loadTransactions(currentPage)
  }, [currentPage, loadTransactions])

  useEffect(() => {
    // Reset to page 1 when filter changes
    setCurrentPage(1)
  }, [selectedAppId])

  useEffect(() => {
    // Reset to page 1 when row count changes
    setCurrentPage(1)
  }, [limit])

  useEffect(() => {
    // Listen for data changes
    const handleDataChange = () => {
      loadTransactions(currentPage)
    }

    window.addEventListener('successRateUploaded', handleDataChange)
    window.addEventListener('dictionaryUploaded', handleDataChange)
    window.addEventListener('appAdded', handleDataChange)

    return () => {
      window.removeEventListener('successRateUploaded', handleDataChange)
      window.removeEventListener('dictionaryUploaded', handleDataChange)
      window.removeEventListener('appAdded', handleDataChange)
    }
  }, [currentPage, loadTransactions])

  // Auto-hide success message after 8 seconds
  useEffect(() => {
    if (message && message.type === 'success') {
      const timer = setTimeout(() => {
        setMessage(null)
      }, 8000)
      return () => clearTimeout(timer)
    }
  }, [message])

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
    if (selectedItems.size === transactions.length) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(transactions.map(t => t.id!)))
    }
  }

  const handleRcChange = (id: number, value: string) => {
    setEditingRc(prev => ({
      ...prev,
      [id]: value
    }))
  }

  const handleRcDescriptionChange = (id: number, value: string) => {
    setEditingRcDescription(prev => ({
      ...prev,
      [id]: value
    }))
  }

  const handleSubmit = async (transaction: SuccessRateEntry) => {
    const id = transaction.id!
    const rc = editingRc[id]?.trim() || ''
    const rcDescription = editingRcDescription[id]?.trim() || ''

    if (!rc || rc === '') {
      setMessage({ text: 'RC is required', type: 'error' })
      return
    }

    try {
      setSubmitting(id)
      setMessage(null)

      const result = await submitMutation.mutateAsync({
        id,
        rc,
        rc_description: rcDescription || null,
      })

      if (result.success) {
        setMessage({ text: result.message || 'RC assigned successfully', type: 'success' })
        // Remove from local state (will be filtered out on next load)
        setTransactions(prev => prev.filter(t => t.id !== id))
        // Clear editing state
        setEditingRc(prev => {
          const newState = { ...prev }
          delete newState[id]
          return newState
        })
        setEditingRcDescription(prev => {
          const newState = { ...prev }
          delete newState[id]
          return newState
        })
        // Dispatch event to notify other components
        window.dispatchEvent(new CustomEvent('noRcTransactionSubmitted'))
      } else {
        throw new Error(result.message || 'Failed to assign RC')
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' })
    } finally {
      setSubmitting(null)
    }
  }

  const handleSubmitAll = async () => {
    const itemsToSubmit = transactions.filter(t => 
      selectedItems.has(t.id!) && bulkRc.trim() !== ''
    )

    if (itemsToSubmit.length === 0) {
      setMessage({ text: 'Please select at least one transaction and provide RC', type: 'error' })
      return
    }

    try {
      setSubmittingAll(true)
      setMessage(null)

      const mappings = itemsToSubmit.map(t => ({
        id: t.id!,
        rc: bulkRc.trim(),
        rc_description: bulkRcDescription.trim() || null,
      }))

      const result = await submitBatchMutation.mutateAsync({ items: mappings })

      if (result.success) {
        setMessage({ 
          text: result.message || `Successfully assigned RC to ${itemsToSubmit.length} transaction(s)`, 
          type: 'success' 
        })
        // Remove submitted items from local state
        const submittedIds = new Set(itemsToSubmit.map(t => t.id!))
        setTransactions(prev => prev.filter(item => !submittedIds.has(item.id!)))
        // Clear selections and bulk inputs
        setSelectedItems(new Set())
        setBulkRc('')
        setBulkRcDescription('')
        // Dispatch event to notify other components
        window.dispatchEvent(new CustomEvent('noRcTransactionSubmitted'))
      } else {
        throw new Error(result.message || 'Failed to assign RCs')
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' })
    } finally {
      setSubmittingAll(false)
    }
  }

  return (
    <div className="glass-card rounded-xl p-3 md:p-4 h-full flex flex-col border border-white/20">
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-2">
        <div className="w-8 h-8 rounded-md bg-gradient-to-br from-orange-600 to-orange-800 flex items-center justify-center shadow-md flex-shrink-0">
          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div className="min-w-0">
          <h2 className="text-sm md:text-base font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent truncate">
            No RC Transaction
          </h2>
          <p className="text-xs text-gray-500">Transactions without RC</p>
        </div>
      </div>

      {/* Filter and pagination controls */}
      <div className="mb-2 space-y-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 min-w-0">
            <label className="block text-xs font-medium text-gray-600 mb-0.5">Application</label>
            <select
              value={selectedAppId}
              onChange={(e) => setSelectedAppId(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all bg-white"
            >
              <option value="">All Applications</option>
              {applications.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.app_name}
                </option>
              ))}
            </select>
          </div>
          <div className={`flex flex-col sm:flex-row gap-2 sm:items-end transition-opacity ${isLoading ? 'opacity-60 pointer-events-none' : ''}`}>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Rows per page</label>
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                disabled={isLoading}
                className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 min-w-[72px] disabled:opacity-70"
              >
                {ROW_COUNT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-1.5">
              <div className="flex items-center rounded-lg border border-gray-200 bg-white overflow-hidden">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1 || isLoading}
                  className="p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  aria-label="Previous page"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="flex items-center gap-1 px-2 py-1 border-x border-gray-100">
                  <input
                    type="number"
                    min={1}
                    max={totalPages || 1}
                    value={currentPage}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10)
                      if (!isNaN(val) && val >= 1) {
                        setCurrentPage(Math.min(val, totalPages || 1))
                      }
                    }}
                    disabled={isLoading}
                    className="w-8 text-center text-sm bg-transparent border-none focus:outline-none focus:ring-0 p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-70"
                  />
                  <span className="text-gray-400 text-xs">/ {totalPages}</span>
                </div>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages || totalPages === 0 || isLoading}
                  className="p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  aria-label="Next page"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              <span className="text-xs text-gray-500 self-center hidden sm:inline">
                {totalCount} total
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`mb-2 p-2 rounded-md text-xs font-medium shadow-md transform transition-all animate-slide-in ${
            message.type === 'success'
              ? 'bg-gradient-to-r from-green-50 to-emerald-50 text-green-800 border border-green-200'
              : 'bg-gradient-to-r from-red-50 to-rose-50 text-red-800 border border-red-200'
          }`}
        >
          <div className="flex gap-1.5 items-center">
            {message.type === 'success' ? (
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            )}
            <span className="flex-1 truncate">{message.text}</span>
          </div>
        </div>
      )}

      {/* Bulk Update Section */}
      {selectedItems.size > 0 && (
        <div className="mb-2 p-2 bg-orange-50 border border-orange-200 rounded-md">
          <div className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              checked={selectedItems.size === transactions.length}
              onChange={handleSelectAll}
              className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
            />
            <span className="text-xs font-semibold text-orange-800">
              {selectedItems.size} selected - Bulk Update
            </span>
          </div>
          <div className="space-y-1.5">
            <input
              type="text"
              placeholder="RC (required)"
              value={bulkRc}
              onChange={(e) => setBulkRc(e.target.value)}
              className="w-full px-2 py-1 text-xs border border-orange-300 rounded focus:outline-none focus:border-orange-500"
            />
            <input
              type="text"
              placeholder="RC Description (optional)"
              value={bulkRcDescription}
              onChange={(e) => setBulkRcDescription(e.target.value)}
              className="w-full px-2 py-1 text-xs border border-orange-300 rounded focus:outline-none focus:border-orange-500"
            />
            <button
              onClick={handleSubmitAll}
              disabled={submittingAll || bulkRc.trim() === ''}
              className="w-full px-2 py-1 text-xs font-semibold bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submittingAll ? 'Updating...' : `Update All (${selectedItems.size})`}
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto mb-1.5 border border-gray-200/50 rounded-md bg-white/60 backdrop-blur-sm shadow-inner min-h-0 max-h-[500px]">
        {isLoading ? (
          <div className="p-2 text-center">
            <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-orange-500 border-t-transparent mb-1"></div>
            <p className="text-gray-500 text-xs">Loading...</p>
          </div>
        ) : error ? (
          <div className="p-2 text-center bg-gradient-to-r from-red-50 to-rose-50 rounded-md m-1.5 border border-red-200">
            <svg className="w-4 h-4 text-red-500 mx-auto mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-600 text-xs font-semibold">Error: {error}</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-3 text-center">
            <svg className="w-6 h-6 text-green-500 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-gray-500 text-xs">No transactions without RC found</p>
          </div>
        ) : (
          <>
            <div className="sticky top-0 bg-gradient-to-r from-orange-600 to-orange-800 text-white text-xs font-bold py-1 px-1.5 rounded-t-md backdrop-blur-sm z-10">
              <div className="flex items-center justify-between">
                <span>Total: {totalCount} Transaksi belum memiliki RC</span>
              </div>
            </div>
            <div className="space-y-1 p-1">
              {transactions.map((transaction) => {
              const id = transaction.id!
              const isSelected = selectedItems.has(id)
              const rcValue = editingRc[id] ?? ''
              const rcDescValue = editingRcDescription[id] ?? ''

              return (
                <div
                  key={id}
                  className="p-2 bg-white/50 rounded border border-gray-200 hover:border-orange-300 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSelectItem(id)}
                      className="mt-1 w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="grid grid-cols-2 gap-1 text-xs">
                        <div>
                          <span className="font-semibold text-gray-700">Date:</span>{' '}
                          <span className="text-gray-600">{transaction.tanggal_transaksi}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-gray-700">Type:</span>{' '}
                          <span className="text-gray-600">{transaction.jenis_transaksi}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-gray-700">Status:</span>{' '}
                          <span className="text-gray-600">{transaction.status_transaksi || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-gray-700">Total:</span>{' '}
                          <span className="text-gray-600">{transaction.total_transaksi || 0}</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <input
                          type="text"
                          placeholder="RC (required)"
                          value={rcValue}
                          onChange={(e) => handleRcChange(id, e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:border-orange-500"
                        />
                        <input
                          type="text"
                          placeholder="RC Description (optional)"
                          value={rcDescValue}
                          onChange={(e) => handleRcDescriptionChange(id, e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:border-orange-500"
                        />
                        <button
                          onClick={() => handleSubmit(transaction)}
                          disabled={submitting === id || rcValue.trim() === ''}
                          className="w-full px-2 py-1 text-xs font-semibold bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {submitting === id ? 'Updating...' : 'Update RC'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
              })}
            </div>
          </>
        )}
      </div>

      {/* Refresh Button */}
      <button
        type="button"
        onClick={() => loadTransactions(currentPage)}
        className="w-full px-2.5 py-1.5 rounded-md font-semibold text-xs transition-all duration-300 bg-gradient-to-r from-orange-500 to-orange-700 text-white hover:from-orange-600 hover:to-orange-800 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-1"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Refresh
      </button>

    </div>
  )
}

