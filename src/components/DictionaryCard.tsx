'use client'

import { useState, useEffect, useCallback } from 'react'
import type { DictionaryViewEntry, Application } from '@/types'
import MultiSelectFilter from './MultiSelectFilter'
import { useApplications } from '@/hooks/useApplications'

export default function DictionaryCard() {
  const [dictionaryEntries, setDictionaryEntries] = useState<DictionaryViewEntry[]>([])
  const [allDictionaryEntries, setAllDictionaryEntries] = useState<DictionaryViewEntry[]>([]) // For export
  const [applications, setApplications] = useState<Application[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedAppIds, setSelectedAppIds] = useState<string[]>([])
  const [selectedErrorTypes, setSelectedErrorTypes] = useState<string[]>([])
  const [selectedJenisTransaksi, setSelectedJenisTransaksi] = useState<string[]>([])
  const [uniqueJenisTransaksi, setUniqueJenisTransaksi] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingErrorType, setEditingErrorType] = useState<'S' | 'N' | 'Sukses' | ''>('')
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())
  const [editingDescriptionId, setEditingDescriptionId] = useState<number | null>(null)
  const [editingDescription, setEditingDescription] = useState<string>('')
  const [bulkDescription, setBulkDescription] = useState<string>('')
  const [submittingDescription, setSubmittingDescription] = useState<number | null>(null)
  const [submittingBulkDescription, setSubmittingBulkDescription] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const limit = 25

  // Use shared applications hook
  const { applications: sharedApplications } = useApplications()
  
  useEffect(() => {
    setApplications(sharedApplications)
  }, [sharedApplications])

  const loadDictionary = useCallback(async (page: number, fetchAll: boolean = false) => {
    try {
      setIsLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (searchQuery) params.append('search', searchQuery)
      if (selectedAppIds.length > 0) params.append('app_id', selectedAppIds.join(','))
      if (selectedErrorTypes.length > 0) params.append('error_type', selectedErrorTypes.join(','))
      if (selectedJenisTransaksi.length > 0) params.append('jenis_transaksi', selectedJenisTransaksi.join(','))

      if (!fetchAll) {
        params.append('page', page.toString())
        params.append('limit', limit.toString())
      }

      const response = await fetch(`/api/dictionary?${params.toString()}`)
      const result = await response.json()

      if (result.success) {
        if (fetchAll) {
          setAllDictionaryEntries(result.data)
        } else {
          setDictionaryEntries(result.data)
          setTotalCount(result.total || result.data.length)
          setTotalPages(result.totalPages || Math.ceil((result.total || result.data.length) / limit))
          
          // Reset selections when data changes
          setSelectedItems(new Set())
          
          // Extract unique jenis_transaksi values from all data
          const uniqueJenis = Array.from(
            new Set(
              result.data
                .map((entry: DictionaryViewEntry) => entry.jenis_transaksi)
                .filter((jenis: string | null) => jenis !== null && jenis !== '')
            )
          ).sort() as string[]
          setUniqueJenisTransaksi(uniqueJenis)
        }
      } else {
        throw new Error(result.message || 'Failed to load dictionary')
      }
    } catch (err: any) {
      setError(err.message)
      console.error('Error loading dictionary:', err)
    } finally {
      setIsLoading(false)
    }
  }, [searchQuery, selectedAppIds, selectedErrorTypes, selectedJenisTransaksi, limit])

  // Applications loaded via useApplications hook

  useEffect(() => {
    // Listen for data changes
    const handleDataChange = () => {
      setCurrentPage(1)
      loadDictionary(1, false)
    }

    window.addEventListener('dictionaryUploaded', handleDataChange)
    window.addEventListener('unmappedRcSubmitted', handleDataChange)
    window.addEventListener('dictionaryUpdated', handleDataChange)

    return () => {
      window.removeEventListener('dictionaryUploaded', handleDataChange)
      window.removeEventListener('unmappedRcSubmitted', handleDataChange)
      window.removeEventListener('dictionaryUpdated', handleDataChange)
    }
  }, [loadDictionary])

  useEffect(() => {
    // Reset to page 1 when filters change
    setCurrentPage(1)
  }, [searchQuery, selectedAppIds, selectedErrorTypes, selectedJenisTransaksi])

  useEffect(() => {
    // Debounce search and load data - single source of truth for data fetching
    const timer = setTimeout(() => {
      loadDictionary(currentPage, false)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, selectedAppIds, selectedErrorTypes, selectedJenisTransaksi, currentPage, loadDictionary])

  const getErrorTypeColor = (errorType: string) => {
    switch (errorType) {
      case 'Sukses':
        return 'bg-green-100 text-green-800 border-green-300'
      case 'S':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'N':
        return 'bg-red-100 text-red-800 border-red-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const handleEditErrorType = (entry: DictionaryViewEntry) => {
    setEditingId(entry.id)
    setEditingErrorType(entry.error_type as 'S' | 'N' | 'Sukses' || '')
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditingErrorType('')
  }

  const handleUpdateErrorType = async (id: number, newErrorType: 'S' | 'N' | 'Sukses') => {
    if (!newErrorType || !['S', 'N', 'Sukses'].includes(newErrorType)) {
      setError('Invalid error type')
      return
    }

    try {
      setUpdatingId(id)
      setError(null)

      const response = await fetch('/api/dictionary/update', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id,
          error_type: newErrorType,
        }),
      })

      const result = await response.json()

      if (result.success) {
        // Update local state
        setDictionaryEntries(prev =>
          prev.map(entry =>
            entry.id === id ? { ...entry, error_type: newErrorType } : entry
          )
        )
        setEditingId(null)
        setEditingErrorType('')
        // Dispatch event to notify other components
        window.dispatchEvent(new CustomEvent('dictionaryUpdated'))
      } else {
        throw new Error(result.message || 'Failed to update error type')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUpdatingId(null)
    }
  }

  const handleEditDescription = (entry: DictionaryViewEntry) => {
    setEditingDescriptionId(entry.id)
    setEditingDescription(entry.rc_description || '')
  }

  const handleCancelEditDescription = () => {
    setEditingDescriptionId(null)
    setEditingDescription('')
  }

  const handleUpdateDescription = async (id: number, newDescription: string) => {
    try {
      setSubmittingDescription(id)
      setError(null)
      setMessage(null)

      const response = await fetch('/api/dictionary/update-description', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id,
          rc_description: newDescription,
        }),
      })

      const result = await response.json()

      if (result.success) {
        setMessage({ text: result.message || 'RC description updated successfully', type: 'success' })
        // Reload data to get updated rc_description
        loadDictionary(currentPage, false)
        setEditingDescriptionId(null)
        setEditingDescription('')
        // Dispatch event to notify other components
        window.dispatchEvent(new CustomEvent('dictionaryUpdated'))
      } else {
        throw new Error(result.message || 'Failed to update RC description')
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' })
    } finally {
      setSubmittingDescription(null)
    }
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
    if (selectedItems.size === dictionaryEntries.length) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(dictionaryEntries.map(entry => entry.id)))
    }
  }

  const handleBulkUpdateDescription = async () => {
    if (selectedItems.size === 0) {
      setMessage({ text: 'Please select at least one entry to update', type: 'error' })
      return
    }

    if (!bulkDescription.trim()) {
      setMessage({ text: 'Please enter a description', type: 'error' })
      return
    }

    try {
      setSubmittingBulkDescription(true)
      setMessage(null)
      setError(null)

      const updates = Array.from(selectedItems).map(id => ({
        id,
        rc_description: bulkDescription.trim(),
      }))

      const response = await fetch('/api/dictionary/update-description-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ updates }),
      })

      const result = await response.json()

      if (result.success) {
        setMessage({ 
          text: result.message || `Successfully updated ${result.data?.success || updates.length} RC description(s)`, 
          type: 'success' 
        })
        // Reload data
        loadDictionary(currentPage, false)
        // Clear selections
        setSelectedItems(new Set())
        setBulkDescription('')
        // Dispatch event to notify other components
        window.dispatchEvent(new CustomEvent('dictionaryUpdated'))
      } else {
        throw new Error(result.message || 'Failed to update RC descriptions')
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' })
    } finally {
      setSubmittingBulkDescription(false)
    }
  }

  const exportToCSV = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      // Fetch all data for export with current filters applied
      const params = new URLSearchParams()
      if (searchQuery) params.append('search', searchQuery)
      if (selectedAppIds.length > 0) params.append('app_id', selectedAppIds.join(','))
      if (selectedErrorTypes.length > 0) params.append('error_type', selectedErrorTypes.join(','))
      if (selectedJenisTransaksi.length > 0) params.append('jenis_transaksi', selectedJenisTransaksi.join(','))
      
      const response = await fetch(`/api/dictionary?${params.toString()}`)
      const result = await response.json()
    
      if (!result.success) {
        throw new Error(result.message || 'Failed to load dictionary for export')
      }

      const exportData = result.data || []
      
      if (exportData.length === 0) {
        setError('No data to export with current filters')
      return
    }

    // Prepare CSV headers
    const headers = ['App Name', 'RC', 'RC Description', 'Error Type', 'Jenis Transaksi']
    
      // Prepare CSV rows from filtered data
      const rows = exportData.map((entry: DictionaryViewEntry) => [
      entry.app_name || '',
      entry.rc || '',
      entry.rc_description || '',
      entry.error_type || '',
      entry.jenis_transaksi || '',
    ])

    // Convert to CSV format
    const csvContent = [
      headers.join(','),
      ...rows.map((row: any) =>
        row.map((cell: any) => {
          // Escape commas and quotes, wrap in quotes if needed
          const cellStr = String(cell).replace(/"/g, '""')
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return `"${cellStr}"`
          }
          return cellStr
        }).join(',')
      ),
    ].join('\n')

    // Create blob and download
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    
      // Generate filename with timestamp and filter info
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
      const filterInfo = selectedAppIds.length > 0 
        ? `_app-${selectedAppIds.join('-')}` 
        : ''
      const filename = `dictionary_export${filterInfo}_${timestamp}.csv`
    
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    } catch (err: any) {
      setError(err.message || 'Failed to export data')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="glass-card rounded-xl p-3 md:p-4 h-full flex flex-col border border-white/20">
      {/* Icon Header with Action Buttons */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-blue-700 to-blue-900 flex items-center justify-center shadow-md flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div className="min-w-0">
            <h2 className="text-sm md:text-base font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
              RC Dictionary
            </h2>
            <p className="text-xs text-gray-500">View RC mappings</p>
          </div>
        </div>

        {/* Action Buttons - Top Right */}
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => exportToCSV()}
            disabled={isLoading}
            className="px-2 py-1.5 rounded-md font-semibold text-xs transition-all duration-300 bg-gradient-to-r from-green-600 to-green-800 text-white hover:from-green-700 hover:to-green-900 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-1"
            title="Export all filtered data to CSV"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="hidden sm:inline">Export</span>
          </button>
          <button
            type="button"
            onClick={() => {
              loadDictionary(currentPage, false)
            }}
            className="px-2 py-1.5 rounded-md font-semibold text-xs transition-all duration-300 bg-gradient-to-r from-blue-600 to-blue-800 text-white hover:from-blue-700 hover:to-blue-900 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-1"
            title="Refresh data"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Search and Filters - Enhanced Design */}
      <div className="mb-2.5 space-y-2">
        {/* Search Input with Icon */}
        <div className="relative group">
          <div className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search RC, description, app..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border-2 border-gray-200 bg-white/95 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm hover:border-gray-300"
          />
        </div>

        {/* Filters Grid - 3 columns with Multi-Select */}
        <div className="grid grid-cols-3 gap-2">
          {/* App Filter */}
          <MultiSelectFilter
            label="App"
            icon={
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            }
            options={applications.map((app) => ({
              value: app.id.toString(),
              label: app.app_name,
            }))}
            selectedValues={selectedAppIds}
            onChange={setSelectedAppIds}
            placeholder="All Apps"
            searchPlaceholder="Search apps..."
          />

          {/* Error Type Filter */}
          <MultiSelectFilter
            label="Error Type"
            icon={
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            }
            options={[
              { value: 'Sukses', label: 'Sukses' },
              { value: 'S', label: 'S' },
              { value: 'N', label: 'N' },
            ]}
            selectedValues={selectedErrorTypes}
            onChange={setSelectedErrorTypes}
            placeholder="All Types"
            searchPlaceholder="Search types..."
          />

          {/* Jenis Transaksi Filter */}
          <MultiSelectFilter
            label="Jenis Transaksi"
            icon={
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            }
            options={uniqueJenisTransaksi.map((jenis) => ({
              value: jenis,
              label: jenis,
            }))}
            selectedValues={selectedJenisTransaksi}
            onChange={setSelectedJenisTransaksi}
            placeholder="All Jenis"
            searchPlaceholder="Search jenis..."
          />
        </div>
      </div>

      {/* Message Display */}
      {message && (
        <div
          className={`mb-2 p-2 rounded-md text-xs font-medium shadow-md transform transition-all animate-slide-in ${
            message.type === 'success'
              ? 'bg-gradient-to-r from-green-50 to-emerald-50 text-green-800 border border-green-200'
              : 'bg-gradient-to-r from-red-50 to-rose-50 text-red-800 border border-red-200'
          }`}
        >
          <div className={`flex gap-1.5 ${message.type === 'error' ? 'items-start' : 'items-center'}`}>
            {message.type === 'success' ? (
              <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            )}
            <span className={`flex-1 ${message.type === 'error' ? 'break-words whitespace-normal' : 'truncate'}`}>{message.text}</span>
            <button
              type="button"
              onClick={() => setMessage(null)}
              className="text-gray-400 hover:text-gray-600 flex-shrink-0"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Bulk Update Description Controls */}
      {selectedItems.size > 0 && (
        <div className="mb-2 p-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-md border border-blue-200">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-blue-800">
              {selectedItems.size} item(s) selected
            </span>
            <input
              type="text"
              placeholder="Enter description for selected items..."
              value={bulkDescription}
              onChange={(e) => setBulkDescription(e.target.value)}
              className="flex-1 min-w-[200px] px-2 py-1 text-xs rounded border border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              type="button"
              onClick={handleBulkUpdateDescription}
              disabled={submittingBulkDescription || !bulkDescription.trim()}
              className="px-2 py-1 rounded text-xs font-semibold transition-all duration-200 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              {submittingBulkDescription ? (
                <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Update All
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedItems(new Set())
                setBulkDescription('')
              }}
              className="px-2 py-1 rounded text-xs font-semibold transition-all duration-200 bg-gray-500 text-white hover:bg-gray-600 flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Dictionary List */}
      <div className="flex-1 overflow-y-auto mb-1.5 border border-gray-200/50 rounded-md bg-white/60 backdrop-blur-sm shadow-inner min-h-0">
        {isLoading ? (
          <div className="p-2 text-center">
            <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent mb-1"></div>
            <p className="text-gray-500 text-xs">Loading...</p>
          </div>
        ) : error ? (
          <div className="p-2 bg-gradient-to-r from-red-50 to-rose-50 rounded-md m-1.5 border border-red-200">
            <div className="flex items-start gap-1.5">
              <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-600 text-xs font-semibold break-words whitespace-normal flex-1">Error: {error}</p>
            </div>
          </div>
        ) : dictionaryEntries.length === 0 ? (
          <div className="p-2 text-center">
            <svg className="w-5 h-5 text-gray-400 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-500 text-xs">No dictionary entries found</p>
          </div>
        ) : (
          <div className="flex flex-col h-full min-h-0">
            {/* Total Count Header - Fixed at top */}
            <div className="bg-gradient-to-r from-blue-700 to-blue-900 text-white text-xs font-bold py-1.5 px-2 rounded-t-md backdrop-blur-sm flex-shrink-0">
              <div className="flex items-center justify-between">
                <span>Showing {dictionaryEntries.length} of {totalCount} entries (Page {currentPage} of {totalPages})</span>
                <label className="flex items-center gap-1 cursor-pointer text-xs font-normal">
                  <input
                    type="checkbox"
                    checked={selectedItems.size === dictionaryEntries.length && dictionaryEntries.length > 0}
                    onChange={handleSelectAll}
                    className="w-3 h-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Select All</span>
                </label>
              </div>
            </div>
            
            {/* Scrollable Table Container */}
            <div className="flex-1 overflow-auto min-h-0">
              <table className="w-full text-xs">
                <thead className="bg-gray-100/90 sticky top-0 z-20 shadow-sm">
                  <tr>
                    <th className="px-2 py-1.5 text-center font-semibold text-gray-700 border-b-2 border-gray-300 w-8">
                      <input
                        type="checkbox"
                        checked={selectedItems.size === dictionaryEntries.length && dictionaryEntries.length > 0}
                        onChange={handleSelectAll}
                        className="w-3 h-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-2 py-1.5 text-left font-semibold text-gray-700 border-b-2 border-gray-300">App</th>
                    <th className="px-2 py-1.5 text-left font-semibold text-gray-700 border-b-2 border-gray-300">RC</th>
                    <th className="px-2 py-1.5 text-left font-semibold text-gray-700 border-b-2 border-gray-300">Description</th>
                    <th className="px-2 py-1.5 text-left font-semibold text-gray-700 border-b-2 border-gray-300">Type</th>
                    <th className="px-2 py-1.5 text-left font-semibold text-gray-700 border-b-2 border-gray-300">Jenis</th>
                    <th className="px-2 py-1.5 text-left font-semibold text-gray-700 border-b-2 border-gray-300">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {dictionaryEntries.map((entry, index) => (
                    <tr
                      key={entry.id}
                      className={`border-b border-gray-200/50 transition-colors duration-150 ${
                        selectedItems.has(entry.id)
                          ? 'bg-gradient-to-r from-blue-100 to-blue-50'
                          : 'hover:bg-gradient-to-r hover:from-blue-50 hover:to-blue-100'
                      }`}
                      style={{ animationDelay: `${index * 0.02}s` }}
                    >
                      <td className="px-2 py-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={selectedItems.has(entry.id)}
                          onChange={() => handleSelectItem(entry.id)}
                          className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-2 py-1.5 font-medium text-gray-800">{entry.app_name}</td>
                      <td className="px-2 py-1.5 font-mono text-gray-700">{entry.rc || '-'}</td>
                      <td className="px-2 py-1.5 text-gray-600 max-w-[150px]">
                        {editingDescriptionId === entry.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={editingDescription}
                              onChange={(e) => setEditingDescription(e.target.value)}
                              className="flex-1 px-2 py-1 text-xs rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleUpdateDescription(entry.id, editingDescription)
                                } else if (e.key === 'Escape') {
                                  handleCancelEditDescription()
                                }
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateDescription(entry.id, editingDescription)}
                              disabled={submittingDescription === entry.id}
                              className="px-1.5 py-1 rounded text-xs font-semibold transition-all duration-200 bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Save"
                            >
                              {submittingDescription === entry.id ? (
                                <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                              ) : (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelEditDescription}
                              disabled={submittingDescription === entry.id}
                              className="px-1.5 py-1 rounded text-xs font-semibold transition-all duration-200 bg-gray-500 text-white hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Cancel"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 group">
                            <span className="truncate flex-1" title={entry.rc_description || ''}>
                        {entry.rc_description || '-'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleEditDescription(entry)}
                              disabled={submittingDescription === entry.id || editingDescriptionId !== null}
                              className="opacity-0 group-hover:opacity-100 px-1 py-0.5 rounded text-xs font-semibold transition-all duration-200 bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-0 disabled:cursor-not-allowed"
                              title="Edit description"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        {editingId === entry.id ? (
                          <div className="flex items-center gap-1">
                            {(['S', 'N', 'Sukses'] as const).map((value) => {
                              const isSelected = editingErrorType === value
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
                                <button
                                  key={value}
                                  type="button"
                                  onClick={() => setEditingErrorType(value)}
                                  disabled={updatingId === entry.id}
                                  className={`px-2 py-0.5 rounded border-2 transition-all duration-200 font-semibold text-xs min-w-[45px] ${
                                    colors.bg
                                  } ${colors.text} ${colors.border} ${colors.hover} ${
                                    isSelected ? 'shadow-md scale-105' : 'shadow-sm'
                                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                  {value}
                                </button>
                              )
                            })}
                          </div>
                        ) : (
                          <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold border ${getErrorTypeColor(entry.error_type)}`}>
                            {entry.error_type}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-gray-600 text-[10px]">{entry.jenis_transaksi || '-'}</td>
                      <td className="px-2 py-1.5">
                        {editingId === entry.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                if (editingErrorType && ['S', 'N', 'Sukses'].includes(editingErrorType)) {
                                  handleUpdateErrorType(entry.id, editingErrorType as 'S' | 'N' | 'Sukses')
                                }
                              }}
                              disabled={updatingId === entry.id || !editingErrorType || !['S', 'N', 'Sukses'].includes(editingErrorType)}
                              className="px-2 py-1 rounded text-xs font-semibold transition-all duration-200 bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                              title="Save"
                            >
                              {updatingId === entry.id ? (
                                <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                              ) : (
                                <>
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  Save
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              disabled={updatingId === entry.id}
                              className="px-2 py-1 rounded text-xs font-semibold transition-all duration-200 bg-gray-500 text-white hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                              title="Cancel"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleEditErrorType(entry)}
                            disabled={updatingId === entry.id}
                            className="px-2 py-1 rounded text-xs font-semibold transition-all duration-200 bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                            title="Edit error type"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {!isLoading && !error && dictionaryEntries.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between mt-2 px-1">
          <button
            type="button"
            onClick={() => {
              const newPage = Math.max(1, currentPage - 1)
              setCurrentPage(newPage)
            }}
            disabled={currentPage === 1}
            className="px-2 py-1 rounded-md text-xs font-medium transition-all duration-200 bg-white border-2 border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-gray-300 flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Prev
          </button>

          <div className="flex items-center gap-1">
            {(() => {
              const pages: (number | string)[] = []
              
              if (totalPages <= 7) {
                // Show all pages if 7 or fewer
                for (let i = 1; i <= totalPages; i++) {
                  pages.push(i)
                }
              } else {
                // Always show first page
                pages.push(1)
                
                if (currentPage <= 4) {
                  // Show: 1, 2, 3, 4, 5, ..., last-2, last-1, last
                  for (let i = 2; i <= 5; i++) {
                    pages.push(i)
                  }
                  pages.push('...')
                  pages.push(totalPages - 2)
                  pages.push(totalPages - 1)
                  pages.push(totalPages)
                } else if (currentPage >= totalPages - 3) {
                  // Show: 1, 2, 3, ..., last-4, last-3, last-2, last-1, last
                  pages.push(2)
                  pages.push(3)
                  pages.push('...')
                  for (let i = totalPages - 4; i <= totalPages; i++) {
                    pages.push(i)
                  }
                } else {
                  // Show: 1, 2, 3, ..., current-1, current, current+1, ..., last-2, last-1, last
                  pages.push(2)
                  pages.push(3)
                  pages.push('...')
                  pages.push(currentPage - 1)
                  pages.push(currentPage)
                  pages.push(currentPage + 1)
                  pages.push('...')
                  pages.push(totalPages - 2)
                  pages.push(totalPages - 1)
                  pages.push(totalPages)
                }
              }

              return pages.map((page, index) => {
                if (page === '...') {
                  return (
                    <span key={`ellipsis-${index}`} className="px-1 text-gray-500">
                      ...
                    </span>
                  )
                }

                const pageNum = page as number
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => {
                      setCurrentPage(pageNum)
                    }}
                    className={`px-2 py-1 rounded-md text-xs font-medium transition-all duration-200 min-w-[28px] ${
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white border-2 border-blue-600'
                        : 'bg-white border-2 border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })
            })()}
          </div>

          <button
            type="button"
            onClick={() => {
              const newPage = Math.min(totalPages, currentPage + 1)
              setCurrentPage(newPage)
            }}
            disabled={currentPage === totalPages}
            className="px-2 py-1 rounded-md text-xs font-medium transition-all duration-200 bg-white border-2 border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-gray-300 flex items-center gap-1"
          >
            Next
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}

