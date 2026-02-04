'use client'

import { useState, useEffect, useRef } from 'react'
import ErrorPopup from './ErrorPopup'
import { useApplications } from '@/hooks/useApplications'

interface SkippedRow {
  rowNumber: number
  reason: string
}

export default function AddSuccessRateCard() {
  const { applications } = useApplications()
  const [selectedAppId, setSelectedAppId] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [message, setMessage] = useState<{
    text: string
    type: 'success' | 'error' | 'info'
  } | null>(null)
  const [showErrorPopup, setShowErrorPopup] = useState(false)
  const [skippedRows, setSkippedRows] = useState<SkippedRow[]>([])
  const [totalSkipped, setTotalSkipped] = useState(0)
  const [totalProcessed, setTotalProcessed] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const requiredColumns = [
    'Tanggal Transaksi',
    'Jenis Transaksi',
    'RC',
    'total transaksi',
    'Total Nominal',
    'Total Biaya Admin',
    'Status Transaksi',
  ]
  const optionalColumns = ['RC Description']

  // Auto-hide success message after 8 seconds
  useEffect(() => {
    if (message && message.type === 'success') {
      const timer = setTimeout(() => {
        setMessage(null)
      }, 8000)
      return () => clearTimeout(timer)
    }
  }, [message])

  const isValidFile = (file: File) => {
    const validExtensions = ['.xlsx', '.xls', '.csv']
    const fileName = file.name.toLowerCase()
    return validExtensions.some((ext) => fileName.endsWith(ext))
  }

  const isCSVFile = (file: File) => {
    return file.name.toLowerCase().endsWith('.csv')
  }

  const parseCSV = (text: string): string[][] => {
    const lines: string[] = []
    let currentLine = ''
    let inQuotes = false

    for (let i = 0; i < text.length; i++) {
      const char = text[i]
      const nextChar = text[i + 1]

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentLine += '"'
          i++ // Skip next quote
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === '\n' || char === '\r') {
        if (!inQuotes) {
          if (currentLine.trim()) {
            lines.push(currentLine)
            currentLine = ''
          }
          // Skip \r\n combination
          if (char === '\r' && nextChar === '\n') {
            i++
          }
        } else {
          currentLine += char
        }
      } else {
        currentLine += char
      }
    }

    if (currentLine.trim()) {
      lines.push(currentLine)
    }

    return lines.map(line => {
      const fields: string[] = []
      let currentField = ''
      let inFieldQuotes = false

      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        const nextChar = line[i + 1]

        if (char === '"') {
          if (inFieldQuotes && nextChar === '"') {
            currentField += '"'
            i++
          } else {
            inFieldQuotes = !inFieldQuotes
          }
        } else if (char === ',' && !inFieldQuotes) {
          fields.push(currentField.trim())
          currentField = ''
        } else {
          currentField += char
        }
      }
      fields.push(currentField.trim())
      return fields
    })
  }

  const validateFileColumns = async (
    file: File
  ): Promise<{ isValid: boolean; error?: string }> => {
    return new Promise((resolve) => {
      const reader = new FileReader()

      reader.onload = (e) => {
        try {
          if (isCSVFile(file)) {
            // Parse CSV
            const text = e.target?.result as string
            const rows = parseCSV(text)
            
            if (rows.length === 0) {
              resolve({ isValid: false, error: 'CSV file is empty' })
              return
            }

            const headers = rows[0].map(h => h.trim())

            // Check if there are 7-8 columns (7 required + 1 optional RC Description)
            if (headers.length < requiredColumns.length || headers.length > requiredColumns.length + optionalColumns.length) {
              resolve({
                isValid: false,
                error: `Invalid column count. Expected ${requiredColumns.length}-${requiredColumns.length + optionalColumns.length} columns (${requiredColumns.length} required + ${optionalColumns.length} optional), got ${headers.length}. Required columns: ${requiredColumns.join(', ')}${optionalColumns.length > 0 ? `. Optional: ${optionalColumns.join(', ')}` : ''}`,
              })
              return
            }

            // Check if all required columns exist (case-insensitive)
            const normalizedHeaders = headers.map((h) => h.toLowerCase())
            const normalizedRequired = requiredColumns.map((r) =>
              r.toLowerCase()
            )

            const missingColumns: string[] = []
            normalizedRequired.forEach((required, index) => {
              if (!normalizedHeaders.includes(required)) {
                missingColumns.push(requiredColumns[index])
              }
            })

            if (missingColumns.length > 0) {
              resolve({
                isValid: false,
                error: `Missing required columns: ${missingColumns.join(', ')}`,
              })
              return
            }

            resolve({ isValid: true })
          } else {
            // Parse Excel
            const data = new Uint8Array(e.target?.result as ArrayBuffer)

            if (typeof window !== 'undefined' && (window as any).XLSX) {
              const XLSX = (window as any).XLSX
              const workbook = XLSX.read(data, { type: 'array' })
              const firstSheetName = workbook.SheetNames[0]
              const worksheet = workbook.Sheets[firstSheetName]

              const range = XLSX.utils.decode_range(worksheet['!ref'])
              const headers: string[] = []

              for (let col = range.s.c; col <= range.e.c; col++) {
                const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col })
                const cell = worksheet[cellAddress]
                if (cell && cell.v) {
                  headers.push(String(cell.v).trim())
                }
              }

              // Check if there are 7-8 columns (7 required + 1 optional RC Description)
              if (headers.length < requiredColumns.length || headers.length > requiredColumns.length + optionalColumns.length) {
                resolve({
                  isValid: false,
                  error: `Invalid column count. Expected ${requiredColumns.length}-${requiredColumns.length + optionalColumns.length} columns (${requiredColumns.length} required + ${optionalColumns.length} optional), got ${headers.length}. Required columns: ${requiredColumns.join(', ')}${optionalColumns.length > 0 ? `. Optional: ${optionalColumns.join(', ')}` : ''}`,
                })
                return
              }

              // Check if all required columns exist (case-insensitive)
              const normalizedHeaders = headers.map((h) => h.toLowerCase())
              const normalizedRequired = requiredColumns.map((r) =>
                r.toLowerCase()
              )

              const missingColumns: string[] = []
              normalizedRequired.forEach((required, index) => {
                if (!normalizedHeaders.includes(required)) {
                  missingColumns.push(requiredColumns[index])
                }
              })

              if (missingColumns.length > 0) {
                resolve({
                  isValid: false,
                  error: `Missing required columns: ${missingColumns.join(', ')}`,
                })
                return
              }

              resolve({ isValid: true })
            } else {
              resolve({ isValid: true })
            }
          }
        } catch (error) {
          console.error('Error validating file:', error)
          resolve({ isValid: false, error: 'Failed to parse file' })
        }
      }

      reader.onerror = () =>
        resolve({ isValid: false, error: 'Failed to read file' })
      
      if (isCSVFile(file)) {
        reader.readAsText(file)
      } else {
        reader.readAsArrayBuffer(file)
      }
    })
  }

  const handleFileSelect = async (file: File) => {
    if (!isValidFile(file)) {
      setMessage({
        text: 'Please upload only Excel files (.xlsx or .xls) or CSV files (.csv)',
        type: 'error',
      })
      return
    }

    setMessage({ text: 'Validating file columns...', type: 'info' })

    const validationResult = await validateFileColumns(file)

    if (validationResult.isValid) {
      setSelectedFile(file)
      setMessage({
        text: 'File valid! Columns verified.',
        type: 'success',
      })
    } else {
      setMessage({
        text: validationResult.error || 'Invalid file format',
        type: 'error',
      })
      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleUpload = async () => {
    if (!selectedAppId) {
      setMessage({ text: 'Please select an application', type: 'error' })
      return
    }

    if (!selectedFile) {
      setMessage({ text: 'Please select a file to upload', type: 'error' })
      return
    }

    try {
      setIsLoading(true)
      setMessage({ text: 'Uploading success rate document...', type: 'info' })

      const formData = new FormData()
      formData.append('successRateFile', selectedFile)
      formData.append('selectedApplicationId', selectedAppId)

      const response = await fetch('/api/upload-success-rate', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (result.success) {
        setIsLoading(false)
        setMessage({ text: result.message, type: 'success' })
        // Dispatch event to notify other components
        window.dispatchEvent(new CustomEvent('successRateUploaded'))
        // Reset form on success
        setSelectedFile(null)
        setSelectedAppId('')
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      } else {
        // Check if response contains skipped rows data
        if (result.data && result.data.skippedRows) {
          setIsLoading(false) // Stop loading immediately when error occurs
          setMessage(null) // Clear loading message
          setSkippedRows(result.data.skippedRows)
          setTotalSkipped(result.data.totalSkipped || 0)
          setTotalProcessed(result.data.totalProcessed || 0)
          setShowErrorPopup(true)
        } else {
          setMessage({ text: result.message || 'Upload failed', type: 'error' })
          setIsLoading(false)
        }
      }
    } catch (error: any) {
      setMessage({ text: `Upload failed: ${error.message}`, type: 'error' })
      setIsLoading(false)
    }
  }

  return (
    <div className="glass-card rounded-xl p-3 md:p-4 flex flex-col transform transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl border border-white/20">
      {/* Icon Header */}
      <div className="flex items-center gap-1.5 mb-2">
        <div className="w-8 h-8 rounded-md bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center shadow-md flex-shrink-0">
          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <div className="min-w-0">
          <h2 className="text-sm md:text-base font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent truncate">
            Add Success Rate Document
          </h2>
          <p className="text-xs text-gray-500">Upload transaction data</p>
        </div>
      </div>

      <div className="mb-2 flex flex-col gap-2">
        <label
          htmlFor="applicationSelectSuccessRate"
          className="block font-semibold text-xs text-gray-700"
        >
          Application:
        </label>
        <select
          id="applicationSelectSuccessRate"
          value={selectedAppId}
          onChange={(e) => setSelectedAppId(e.target.value)}
          className="w-full px-2.5 py-1.5 border-2 border-gray-200 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-all bg-white/80 backdrop-blur-sm"
        >
          <option value="">-- Select Application --</option>
          {applications.map((app) => (
            <option key={app.id} value={app.id}>
              {app.app_name}
            </option>
          ))}
        </select>

        <div
          className={`border-2 border-dashed rounded-md p-3 text-center transition-all cursor-pointer relative overflow-hidden ${
            isDragging
              ? 'border-blue-500 bg-gradient-to-br from-blue-100 to-blue-50 scale-105'
              : 'border-gray-300 bg-gradient-to-br from-gray-50 to-blue-50 hover:border-blue-400 hover:from-blue-50 hover:to-blue-100'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          {selectedFile ? (
            <div className="space-y-0.5">
              <svg className="w-6 h-6 text-blue-600 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs font-semibold text-gray-700 truncate px-1">
                {selectedFile.name}
              </p>
              <p className="text-xs text-gray-500">Click to change</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              <svg className="w-8 h-8 text-gray-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-xs font-medium text-gray-700">
                Drag & drop or click
              </p>
              <p className="text-xs text-gray-400">Excel or CSV file</p>
              <p className="text-xs text-gray-400 mt-1">
                Required: {requiredColumns.join(', ')}
              </p>
              {optionalColumns.length > 0 && (
                <p className="text-xs text-gray-400">
                  Optional: {optionalColumns.join(', ')}
                </p>
              )}
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileInputChange}
            className="hidden"
          />
        </div>
      </div>

      {message && (
        <div
          className={`mb-2 p-2 rounded-md text-xs font-medium shadow-md transform transition-all animate-slide-in ${
            message.type === 'success'
              ? 'bg-gradient-to-r from-green-50 to-emerald-50 text-green-800 border border-green-200'
              : message.type === 'error'
              ? 'bg-gradient-to-r from-red-50 to-rose-50 text-red-800 border border-red-200'
              : 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-800 border border-blue-200'
          }`}
        >
          <div className={`flex gap-1.5 ${message.type === 'error' ? 'items-start' : 'items-center'}`}>
            {message.type === 'success' ? (
              <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : message.type === 'error' ? (
              <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            <span className={`flex-1 ${message.type === 'error' ? 'break-words whitespace-normal' : 'truncate'}`}>{message.text}</span>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleUpload}
        disabled={isLoading || !selectedAppId || !selectedFile}
        className="w-full px-2.5 py-1.5 rounded-md font-semibold text-xs transition-all duration-300 bg-gradient-to-r from-blue-600 to-blue-800 text-white hover:from-blue-700 hover:to-blue-900 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 relative overflow-hidden group"
      >
        <span className="relative z-10 flex items-center justify-center gap-1.5">
          {isLoading ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Uploading...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Upload
            </>
          )}
        </span>
        <div className="absolute inset-0 bg-white/20 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300" />
      </button>

      <ErrorPopup
        isOpen={showErrorPopup}
        onClose={() => {
          setShowErrorPopup(false)
          setMessage(null) // Clear any remaining loading message when popup is closed
        }}
        skippedRows={skippedRows}
        totalSkipped={totalSkipped}
        totalProcessed={totalProcessed}
      />
    </div>
  )
}

