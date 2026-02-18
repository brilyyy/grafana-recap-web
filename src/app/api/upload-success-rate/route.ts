import { NextRequest, NextResponse } from 'next/server'
import pool, { getDb } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { logAuditEvent, getClientIp, getUserAgent } from '@/lib/audit'
import type { ApiResponse, SuccessRateEntry } from '@/types'
import * as XLSX from 'xlsx'

// Helper function to parse CSV
function parseCSV(text: string): string[][] {
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

export async function POST(request: NextRequest) {
  try {
    const session = requireAuth(request)
    const formData = await request.formData()
    const file = formData.get('successRateFile') as File
    const selectedApplicationId = formData.get('selectedApplicationId') as string

    // Check if file was uploaded
    if (!file) {
      return NextResponse.json(
        {
          success: false,
          message: 'No file uploaded',
        } as ApiResponse,
        { status: 400 }
      )
    }

    // Validate application ID
    if (!selectedApplicationId || isNaN(parseInt(selectedApplicationId))) {
      return NextResponse.json(
        {
          success: false,
          message: 'Valid application selection is required',
        } as ApiResponse,
        { status: 400 }
      )
    }

    const applicationId = parseInt(selectedApplicationId)

    // Check if file is CSV
    const isCSV = file.name.toLowerCase().endsWith('.csv')
    let headers: string[] = []
    let successRateData: SuccessRateEntry[] = []
    const skippedRows: Array<{ rowNumber: number; reason: string }> = []

    if (isCSV) {
      // Parse CSV file
      const text = await file.text()
      const rows = parseCSV(text)

      if (rows.length === 0) {
        return NextResponse.json(
          {
            success: false,
            message: 'CSV file is empty',
          } as ApiResponse,
          { status: 400 }
        )
      }

      // Get headers from first row
      headers = rows[0].map(h => h.trim())

      // Validate columns - accept 7-8 columns (7 required + 1 optional RC Description)
      if (headers.length < requiredColumns.length || headers.length > requiredColumns.length + optionalColumns.length) {
        return NextResponse.json(
          {
            success: false,
            message: `Invalid column count. Expected ${requiredColumns.length}-${requiredColumns.length + optionalColumns.length} columns (${requiredColumns.length} required + ${optionalColumns.length} optional), got ${headers.length}. Required columns: ${requiredColumns.join(', ')}${optionalColumns.length > 0 ? `. Optional: ${optionalColumns.join(', ')}` : ''}`,
          } as ApiResponse,
          { status: 400 }
        )
      }

      // Check required columns (case-insensitive)
      const normalizedHeaders = headers.map((h) => h.toLowerCase())
      const normalizedRequired = requiredColumns.map((r) => r.toLowerCase())

      const missingColumns = normalizedRequired.filter(
        (required) => !normalizedHeaders.includes(required)
      )

      if (missingColumns.length > 0) {
        return NextResponse.json(
          {
            success: false,
            message: `Missing required columns: ${missingColumns.join(', ')}`,
          } as ApiResponse,
          { status: 400 }
        )
      }

      // Find column indices for required columns
      const columnIndices: Record<string, number> = {}
      requiredColumns.forEach((colName) => {
        columnIndices[colName] = normalizedHeaders.indexOf(colName.toLowerCase())
      })
      
      // Find optional column indices
      optionalColumns.forEach((colName) => {
        const index = normalizedHeaders.indexOf(colName.toLowerCase())
        if (index >= 0) {
          columnIndices[colName] = index
        }
      })

      // Process CSV rows (skip header row)
      for (let rowNum = 1; rowNum < rows.length; rowNum++) {
        const row = rows[rowNum]
        const actualRowNumber = rowNum + 1 // +1 karena rowNum dimulai dari 1 (skip header), tapi user melihat dari row 2
        
        if (row.length < requiredColumns.length) {
          skippedRows.push({
            rowNumber: actualRowNumber,
            reason: `Jumlah kolom kurang dari ${requiredColumns.length} kolom required (hanya ${row.length} kolom)`
          })
          continue
        }

        const rowData: Record<string, string> = {}
        requiredColumns.forEach((colName) => {
          const colIndex = columnIndices[colName]
          rowData[colName] = (row[colIndex] || '').trim()
        })
        
        // Add optional columns if they exist
        optionalColumns.forEach((colName) => {
          if (columnIndices[colName] !== undefined) {
            const colIndex = columnIndices[colName]
            rowData[colName] = (row[colIndex] || '').trim()
          }
        })

        // Basic validation - skip completely empty rows (hanya cek apakah ada data)
        const hasData = [
          'Tanggal Transaksi',
          'Jenis Transaksi',
        ].some((col) => rowData[col] && rowData[col] !== '')

        if (!hasData) {
          // Skip empty rows silently (tidak perlu ditambahkan ke skippedRows)
          // karena ini adalah rows kosong di akhir file yang normal
          continue
        }

        // Parse date
        let tanggalTransaksi: string | null = null
        let bulan: string | null = null
        let tahun: number | null = null

        const dateStr = rowData['Tanggal Transaksi']
        if (dateStr) {
          // Try DD/MM/YYYY format (Indonesian)
          const parts = dateStr.split('/')
          if (parts.length === 3) {
            const day = parseInt(parts[0])
            const month = parseInt(parts[1])
            const year = parseInt(parts[2])
            if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
              const dateValue = new Date(year, month - 1, day)
              if (!isNaN(dateValue.getTime())) {
                tanggalTransaksi = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                bulan = String(month)
                tahun = year
              }
            }
          }

          // Try YYYY-MM-DD format (ISO)
          if (!tanggalTransaksi) {
            const isoParts = dateStr.split('-')
            if (isoParts.length === 3) {
              const year = parseInt(isoParts[0])
              const month = parseInt(isoParts[1])
              const day = parseInt(isoParts[2])
              if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
                const dateValue = new Date(year, month - 1, day)
                if (!isNaN(dateValue.getTime())) {
                  tanggalTransaksi = dateStr
                  bulan = String(month)
                  tahun = year
                }
              }
            }
          }

          // Try parsing as Date object
          if (!tanggalTransaksi) {
            const dateValue = new Date(dateStr)
            if (!isNaN(dateValue.getTime())) {
              const localYear = dateValue.getFullYear()
              const localMonth = dateValue.getMonth() + 1
              const localDay = dateValue.getDate()
              tanggalTransaksi = `${localYear}-${String(localMonth).padStart(2, '0')}-${String(localDay).padStart(2, '0')}`
              bulan = String(localMonth)
              tahun = localYear
            }
          }
        }

        // Validasi WAJIB: tanggal_transaksi, bulan, tahun, jenis_transaksi
        if (!tanggalTransaksi || !bulan || !tahun) {
          skippedRows.push({
            rowNumber: actualRowNumber,
            reason: `Tanggal Transaksi tidak valid atau kosong: "${dateStr || '(kosong)'}". Format yang diterima: DD/MM/YYYY atau YYYY-MM-DD`
          })
          continue
        }

        let jenisTransaksi = rowData['Jenis Transaksi']?.trim() || null
        if (!jenisTransaksi || jenisTransaksi === '') {
          skippedRows.push({
            rowNumber: actualRowNumber,
            reason: 'Jenis Transaksi wajib diisi dan tidak boleh kosong'
          })
          continue
        }

        let rc = rowData['RC']?.trim() || null
        if (rc === '') rc = null // Convert empty string to null
        
        let rcDescription = rowData['RC Description']?.trim() || null

        // Status Transaksi: BOLEH null/kosong/value apapun (disimpan sebagai VARCHAR)
        // Tidak ada validasi enum, simpan value asli untuk digunakan di business rule error_type assignment
        const rawStatus = rowData['Status Transaksi']?.trim() || null
        let statusTransaksi: string | null = null
        
        if (rawStatus && rawStatus !== '') {
          statusTransaksi = rawStatus // Simpan value asli, tidak perlu validasi enum
        }
        // Jika null/kosong, statusTransaksi tetap null (boleh)

        // Business rule: Jika RC kosong/null atau RC='-', cek apakah transaksi sukses
        // Jika RC Description atau status_transaksi menunjukkan sukses → set RC='00'
        const rcValue = rc?.trim() || ''
        const isRcEmpty = !rcValue || rcValue === '' || rcValue === '-'
        
        if (isRcEmpty) {
          const normalizedRcDescription = rcDescription?.toLowerCase()?.trim() || ''
          const normalizedStatus = statusTransaksi?.toLowerCase()?.trim() || ''
          
          const isRcDescriptionSukses = 
            normalizedRcDescription === 'sukses' ||
            normalizedRcDescription === 'success' ||
            normalizedRcDescription === 'berhasil'
          
          const isStatusSukses = 
            normalizedStatus === 'sukses' ||
            normalizedStatus === 'success' ||
            normalizedStatus === 'berhasil'
          
          if (isRcDescriptionSukses || isStatusSukses) {
            // RC kosong/null/'-' + (RC Description sukses ATAU status sukses) → set RC='00'
            rc = '00'
          }
        }

        const totalTransaksi = rowData['total transaksi']
          ? parseInt(rowData['total transaksi'])
          : null
        const totalNominal = rowData['Total Nominal']
          ? parseFloat(rowData['Total Nominal'])
          : null
        const totalBiayaAdmin = rowData['Total Biaya Admin']
          ? parseFloat(rowData['Total Biaya Admin'])
          : null

        successRateData.push({
          tanggal_transaksi: tanggalTransaksi,
          bulan: bulan!,
          tahun: tahun!,
          jenis_transaksi: jenisTransaksi!,
          rc: rc,
          rc_description: rcDescription,
          total_transaksi: totalTransaksi,
          total_nominal: totalNominal,
          total_biaya_admin: totalBiayaAdmin,
          status_transaksi: statusTransaksi,
          error_type: null,
          id_app_identifier: applicationId,
        })
      }
    } else {
      // Parse Excel file
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      const workbook = XLSX.read(buffer, { type: 'buffer' })

      if (workbook.SheetNames.length === 0) {
        return NextResponse.json(
          {
            success: false,
            message: 'Excel file contains no worksheets',
          } as ApiResponse,
          { status: 400 }
        )
      }

      const firstSheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[firstSheetName]

      // Get headers from first row
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1')
      headers = []

      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col })
        const cell = worksheet[cellAddress]
        if (cell && cell.v) {
          headers.push(String(cell.v).trim())
        }
      }

      // Validate columns - accept 7-8 columns (7 required + 1 optional RC Description)
      if (headers.length < requiredColumns.length || headers.length > requiredColumns.length + optionalColumns.length) {
        return NextResponse.json(
          {
            success: false,
            message: `Invalid column count. Expected ${requiredColumns.length}-${requiredColumns.length + optionalColumns.length} columns (${requiredColumns.length} required + ${optionalColumns.length} optional), got ${headers.length}. Required columns: ${requiredColumns.join(', ')}${optionalColumns.length > 0 ? `. Optional: ${optionalColumns.join(', ')}` : ''}`,
          } as ApiResponse,
          { status: 400 }
        )
      }

      // Check required columns (case-insensitive)
      const normalizedHeaders = headers.map((h) => h.toLowerCase())
      const normalizedRequired = requiredColumns.map((r) => r.toLowerCase())

      const missingColumns = normalizedRequired.filter(
        (required) => !normalizedHeaders.includes(required)
      )

      if (missingColumns.length > 0) {
        return NextResponse.json(
          {
            success: false,
            message: `Missing required columns: ${missingColumns.join(', ')}`,
          } as ApiResponse,
          { status: 400 }
        )
      }

      // Find column indices for required columns
      const columnIndices: Record<string, number> = {}
      requiredColumns.forEach((colName) => {
        columnIndices[colName] = normalizedHeaders.indexOf(colName.toLowerCase())
      })
      
      // Find optional column indices
      optionalColumns.forEach((colName) => {
        const index = normalizedHeaders.indexOf(colName.toLowerCase())
        if (index >= 0) {
          columnIndices[colName] = index
        }
      })

      // Collect data from rows (skip header row)
      successRateData = []
      let consecutiveEmptyRows = 0
      const MAX_CONSECUTIVE_EMPTY = 10 // Stop jika 10 rows berturut-turut kosong

      for (let rowNum = 1; rowNum <= range.e.r; rowNum++) {
        const actualRowNumber = rowNum + 1 // +1 karena rowNum dimulai dari 1 (skip header), tapi user melihat dari row 2
        const rowData: Record<string, string> = {}

        // Get cell values for each required column
        requiredColumns.forEach((colName) => {
          const colIndex = columnIndices[colName]
          const cell = worksheet[XLSX.utils.encode_cell({ r: rowNum, c: colIndex })]
          const cellValue = cell && cell.v ? String(cell.v).trim() : ''
          rowData[colName] = cellValue
        })
        
        // Get cell values for optional columns if they exist
        optionalColumns.forEach((colName) => {
          if (columnIndices[colName] !== undefined) {
            const colIndex = columnIndices[colName]
            const cell = worksheet[XLSX.utils.encode_cell({ r: rowNum, c: colIndex })]
            const cellValue = cell && cell.v ? String(cell.v).trim() : ''
            rowData[colName] = cellValue
          }
        })

        // Basic validation - skip completely empty rows (hanya cek apakah ada data)
        const hasData = [
          'Tanggal Transaksi',
          'Jenis Transaksi',
        ].some((col) => rowData[col] && rowData[col] !== '')

        if (!hasData) {
          consecutiveEmptyRows++
          // Jika banyak rows kosong berturut-turut, kemungkinan sudah sampai akhir data
          // Stop loop untuk menghindari memproses ribuan empty rows
          if (consecutiveEmptyRows >= MAX_CONSECUTIVE_EMPTY) {
            break
          }
          // Skip empty rows silently (tidak perlu ditambahkan ke skippedRows)
          continue
        }

        // Reset counter jika menemukan data
        consecutiveEmptyRows = 0

        // Validate and format data
        let tanggalTransaksi: string | null = null
        let bulan: string | null = null
        let tahun: number | null = null

        const rawCell =
          worksheet[
            XLSX.utils.encode_cell({ r: rowNum, c: columnIndices['Tanggal Transaksi'] })
          ]

        if (rawCell) {
          let dateValue: Date | null = null

          // Excel date (type 'd') or numeric date (Excel serial number)
          if (rawCell.t === 'd') {
            dateValue = rawCell.v
          } else if (rawCell.t === 'n') {
            // Excel date serial number → convert to JS date
            const parsed = XLSX.SSF.parse_date_code(rawCell.v)
            if (parsed) {
              dateValue = new Date(parsed.y, parsed.m - 1, parsed.d)
            }
          } else {
            // Fallback for string date
            const dateStr = String(rawCell.v).trim()

            // Try DD/MM/YYYY format (Indonesian)
            const parts = dateStr.split('/')
            if (parts.length === 3) {
              const day = parseInt(parts[0])
              const month = parseInt(parts[1])
              const year = parseInt(parts[2])
              if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                dateValue = new Date(year, month - 1, day)
              }
            }

            // Try YYYY-MM-DD format (ISO)
            if (!dateValue || isNaN(dateValue.getTime())) {
              const isoParts = dateStr.split('-')
              if (isoParts.length === 3) {
                const year = parseInt(isoParts[0])
                const month = parseInt(isoParts[1])
                const day = parseInt(isoParts[2])
                if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
                  dateValue = new Date(year, month - 1, day)
                }
              }
            }

            if (!dateValue || isNaN(dateValue.getTime())) {
              dateValue = new Date(rawCell.v)
            }
          }

          if (dateValue && !isNaN(dateValue.getTime())) {
            const localYear = dateValue.getFullYear()
            const localMonth = dateValue.getMonth() + 1
            const localDay = dateValue.getDate()
            tanggalTransaksi = `${localYear}-${String(localMonth).padStart(2, '0')}-${String(localDay).padStart(2, '0')}`
            bulan = String(localMonth)
            tahun = localYear
          } else {
            skippedRows.push({
              rowNumber: actualRowNumber,
              reason: `Tanggal Transaksi tidak valid: "${rawCell.v || '(kosong)'}". Format yang diterima: DD/MM/YYYY atau YYYY-MM-DD`
            })
            continue
          }
        } else {
          skippedRows.push({
            rowNumber: actualRowNumber,
            reason: 'Tanggal Transaksi kosong atau tidak ditemukan'
          })
          continue
        }

        // Validasi WAJIB: tanggal_transaksi, bulan, tahun, jenis_transaksi
        if (!tanggalTransaksi || !bulan || !tahun) {
          skippedRows.push({
            rowNumber: actualRowNumber,
            reason: `Tanggal Transaksi tidak valid atau kosong. Format yang diterima: DD/MM/YYYY atau YYYY-MM-DD`
          })
          continue
        }

        let jenisTransaksi = rowData['Jenis Transaksi']?.trim() || null
        if (!jenisTransaksi || jenisTransaksi === '') {
          skippedRows.push({
            rowNumber: actualRowNumber,
            reason: 'Jenis Transaksi wajib diisi dan tidak boleh kosong'
          })
          continue
        }

        let rc = rowData['RC']?.trim() || null
        if (rc === '') rc = null // Convert empty string to null
        
        let rcDescription = rowData['RC Description']?.trim() || null

        // Status Transaksi: BOLEH null/kosong/tidak valid (disimpan sebagai VARCHAR)
        const rawStatus = rowData['Status Transaksi']?.trim() || null
        let statusTransaksi: string | null = null
        
        if (rawStatus && rawStatus !== '') {
          statusTransaksi = rawStatus // Simpan value asli (boleh value apapun)
        }
        // Jika null/kosong, statusTransaksi tetap null (boleh)

        // Business rule: Jika RC kosong/null atau RC='-', cek apakah transaksi sukses
        // Jika RC Description atau status_transaksi menunjukkan sukses → set RC='00'
        const rcValue = rc?.trim() || ''
        const isRcEmpty = !rcValue || rcValue === '' || rcValue === '-'
        
        if (isRcEmpty) {
          const normalizedRcDescription = rcDescription?.toLowerCase()?.trim() || ''
          const normalizedStatus = statusTransaksi?.toLowerCase()?.trim() || ''
          
          const isRcDescriptionSukses = 
            normalizedRcDescription === 'sukses' ||
            normalizedRcDescription === 'success' ||
            normalizedRcDescription === 'berhasil'
          
          const isStatusSukses = 
            normalizedStatus === 'sukses' ||
            normalizedStatus === 'success' ||
            normalizedStatus === 'berhasil'
          
          if (isRcDescriptionSukses || isStatusSukses) {
            // RC kosong/null/'-' + (RC Description sukses ATAU status sukses) → set RC='00'
            rc = '00'
          }
        }

        const totalTransaksi = rowData['total transaksi']
          ? parseInt(rowData['total transaksi'])
          : null
        const totalNominal = rowData['Total Nominal']
          ? parseFloat(rowData['Total Nominal'])
          : null
        const totalBiayaAdmin = rowData['Total Biaya Admin']
          ? parseFloat(rowData['Total Biaya Admin'])
          : null

        successRateData.push({
          tanggal_transaksi: tanggalTransaksi!,
          bulan: bulan!,
          tahun: tahun!,
          jenis_transaksi: jenisTransaksi!,
          rc: rc,
          rc_description: rcDescription,
          total_transaksi: totalTransaksi,
          total_nominal: totalNominal,
          total_biaya_admin: totalBiayaAdmin,
          status_transaksi: statusTransaksi,
          error_type: null,
          id_app_identifier: applicationId,
        })
      }
    }

    // ⚠️ CRITICAL: Check if there are skipped rows - fail upload if any rows were skipped
    // Semua validasi harus dilakukan SEBELUM insert ke database
    if (skippedRows.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `Upload gagal: ${skippedRows.length} row(s) memiliki error dan di-skip`,
          data: {
            skippedRows: skippedRows,
            totalSkipped: skippedRows.length,
            totalProcessed: successRateData.length,
          },
        } as ApiResponse & { data: { skippedRows: Array<{ rowNumber: number; reason: string }>; totalSkipped: number; totalProcessed: number } },
        { status: 400 }
      )
    }

    if (successRateData.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'No valid success rate data found in the file',
        } as ApiResponse,
        { status: 400 }
      )
    }

    // Insert data into database
    const connection = await pool.getConnection()
    try {
      // First, verify the application exists
      const [appResult]: any = await connection.execute(
        'SELECT app_name FROM app_identifier WHERE id = ?',
        [applicationId]
      )

      if (appResult.length === 0) {
        return NextResponse.json(
          {
            success: false,
            message: 'Selected application does not exist',
          } as ApiResponse,
          { status: 400 }
        )
      }

      const applicationName = appResult[0].app_name

        // ⚠️ CRITICAL: Start transaction untuk rollback jika ada error
      await connection.beginTransaction()

      try {
        // Lookup error_type from response_code_dictionary for each entry
        // PENTING: Error_type assignment harus exact match: id_app_identifier + jenis_transaksi + rc
        // Tidak ada fallback ke RC only karena jenis_transaksi dan id_app_identifier juga mempengaruhi RC
        for (const entry of successRateData) {
          let foundInDictionary = false

          // Logic: Error_type assignment berdasarkan RC
          // Handle RC='-' sebagai empty RC
          const rcValue = entry.rc?.trim() || ''
          const isRcEmpty = !rcValue || rcValue === '' || rcValue === '-'
          
          if (!isRcEmpty && entry.jenis_transaksi) {
            const [dictionaryResult]: any = await connection.execute(
              'SELECT error_type FROM response_code_dictionary WHERE id_app_identifier = ? AND jenis_transaksi = ? AND rc = ?',
              [applicationId, entry.jenis_transaksi, entry.rc]
            )

            if (dictionaryResult.length > 0) {
              entry.error_type = dictionaryResult[0].error_type
              foundInDictionary = true
            }

            // RC tidak ada di dictionary → Masuk ke unmapped_rc
            if (!foundInDictionary) {
              // Use database-agnostic INSERT IGNORE / ON CONFLICT DO NOTHING
              let insertUnmappedQuery: string
              
              if (getDb().getDatabaseType() === 'postgresql') {
                // PostgreSQL: Use ON CONFLICT DO NOTHING (connection.execute will convert ? to $1, $2, etc.)
                insertUnmappedQuery = `
                  INSERT INTO unmapped_rc 
                  (id_app_identifier, jenis_transaksi, rc, rc_description, status_transaksi, error_type)
                  VALUES (?, ?, ?, ?, ?, NULL)
                  ON CONFLICT (id_app_identifier, jenis_transaksi, rc) DO NOTHING
                `
              } else {
                // MySQL: Use INSERT IGNORE
                insertUnmappedQuery = `
                  INSERT IGNORE INTO unmapped_rc 
                  (id_app_identifier, jenis_transaksi, rc, rc_description, status_transaksi, error_type)
                  VALUES (?, ?, ?, ?, ?, NULL)
                `
              }
              
              await connection.execute(insertUnmappedQuery, [
                applicationId,
                entry.jenis_transaksi,
                entry.rc,
                entry.rc_description,
                entry.status_transaksi
              ])
            }
          } else {
            const normalizedRcDescription = entry.rc_description?.toLowerCase()?.trim() || ''
            const normalizedStatus = entry.status_transaksi?.toLowerCase()?.trim() || ''
            
            const isRcDescriptionSukses = 
              normalizedRcDescription === 'sukses' ||
              normalizedRcDescription === 'success' ||
              normalizedRcDescription === 'berhasil'
            
            const isStatusSukses = 
              normalizedStatus === 'sukses' ||
              normalizedStatus === 'success' ||
              normalizedStatus === 'berhasil'
            
            if (isRcDescriptionSukses || isStatusSukses) {
              // RC NULL/empty/'-' + (RC Description sukses ATAU status sukses) → set RC='00' dan error_type = 'Sukses'
              entry.rc = '00'
              entry.error_type = 'Sukses'
            } else {
              // RC NULL/empty/'-' + tidak ada indikasi sukses → error_type = NULL (akan tampil di No RC Transaction Card)
              entry.error_type = null
            }
          }
        }

        // Insert data into app_success_rate table
        const insertQuery = `
          INSERT INTO app_success_rate (
            id_app_identifier, tanggal_transaksi, bulan, tahun, jenis_transaksi, rc, rc_description,
            total_transaksi, total_nominal, total_biaya_admin, status_transaksi, error_type
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `

        for (const entry of successRateData) {
          await connection.execute(insertQuery, [
            entry.id_app_identifier,
            entry.tanggal_transaksi,
            entry.bulan,
            entry.tahun,
            entry.jenis_transaksi,
            entry.rc,
            entry.rc_description,
            entry.total_transaksi,
            entry.total_nominal,
            entry.total_biaya_admin,
            entry.status_transaksi,
            entry.error_type,
          ])
        }

        // Commit transaction jika semua berhasil
        await connection.commit()

        // Log audit event
        await logAuditEvent(
          session.userId,
          session.username,
          'SUCCESS_RATE_UPLOADED',
          'app_success_rate',
          applicationId.toString(),
          `Uploaded success rate for application: ${applicationName}. ${successRateData.length} entries processed.`,
          getClientIp(request),
          getUserAgent(request)
        )

        return NextResponse.json({
          success: true,
          message: `Success rate document uploaded successfully. ${successRateData.length} entries processed.`,
          data: {
            entriesProcessed: successRateData.length,
            applicationId: applicationId,
            applicationName: applicationName,
          },
        } as ApiResponse)
      } catch (error: any) {
        // Rollback transaction jika ada error
        await connection.rollback()
        throw error
      }
    } finally {
      connection.release()
    }
  } catch (error: any) {
    // Handle authentication errors
    if (error.message?.includes('Unauthorized') || error.message?.includes('Forbidden')) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
        } as ApiResponse,
        { status: 403 }
      )
    }
    
    console.error('Error uploading success rate:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error processing success rate file: ' + error.message,
      } as ApiResponse,
      { status: 500 }
    )
  }
}

