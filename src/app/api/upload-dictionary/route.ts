import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { logAuditEvent, getClientIp, getUserAgent } from '@/lib/audit'
import type { ApiResponse } from '@/types'
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

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const session = requireAuth(request)
    const formData = await request.formData()
    const file = formData.get('dictionaryFile') as File
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
    let dictionaryData: Array<{
      jenis_transaksi: string
      rc: string
      rc_description: string | null
      error_type: 'S' | 'N' | 'Sukses'
    }> = []
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
        const headers = rows[0].map(h => h.trim())

      // Validate columns - now expect 4 columns (with RC Description)
        if (headers.length < 3 || headers.length > 4) {
          return NextResponse.json(
            {
              success: false,
            message: `Invalid column count. Expected 3-4 columns (Jenis Transaksi, RC, S/N, [RC Description]), got ${headers.length}`,
            } as ApiResponse,
            { status: 400 }
          )
        }

        // Check required columns (case-insensitive)
        const normalizedHeaders = headers.map((h) => h.toLowerCase())
      const requiredColumns = ['jenis transaksi', 'rc', 's/n']
      const optionalColumns = ['rc description']

        const missingColumns = requiredColumns.filter(
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

        // Find column indices
        const jenisTransaksiIndex = normalizedHeaders.indexOf('jenis transaksi')
        const rcIndex = normalizedHeaders.indexOf('rc')
      const snIndex = normalizedHeaders.indexOf('s/n')
      const rcDescriptionIndex = normalizedHeaders.includes('rc description') 
        ? normalizedHeaders.indexOf('rc description') 
        : -1

        // Process CSV rows (skip header row)
        for (let rowNum = 1; rowNum < rows.length; rowNum++) {
          const row = rows[rowNum]
        const actualRowNumber = rowNum + 1 // +1 karena rowNum dimulai dari 1 (skip header), tapi user melihat dari row 2
        
        if (row.length < 3) {
          skippedRows.push({
            rowNumber: actualRowNumber,
            reason: `Jumlah kolom kurang dari 3 kolom required (hanya ${row.length} kolom)`
          })
          continue
        }

          const jenisTransaksi = (row[jenisTransaksiIndex] || '').trim()
          const rc = (row[rcIndex] || '').trim()
        const rawSn = (row[snIndex] || '').trim().toUpperCase()
        const rcDescription = rcDescriptionIndex >= 0 && row[rcDescriptionIndex] 
          ? (row[rcDescriptionIndex] || '').trim() 
          : null

        // Basic validation - skip completely empty rows (hanya cek apakah ada data)
        const hasData = jenisTransaksi !== '' || rc !== ''

        if (!hasData) {
          // Skip empty rows silently (tidak perlu ditambahkan ke skippedRows)
          // karena ini adalah rows kosong di akhir file yang normal
          continue
        }

        // Map S/N values to error_type
          let errorType: 'S' | 'N' | 'Sukses' | null = null
        if (rawSn === 'S') {
            errorType = 'S'
        } else if (rawSn === 'N') {
            errorType = 'N'
          } else if (
          rawSn === 'SUKSES' ||
          rawSn === 'SUCCESS' ||
          rawSn === 'BERHASIL'
          ) {
            errorType = 'Sukses'
          }

        // Validate row data - skip if missing error_type
          if (!errorType) {
          skippedRows.push({
            rowNumber: actualRowNumber,
            reason: `Kolom S/N tidak valid: "${rawSn || '(kosong)'}". Nilai yang diterima: S, N, Sukses/Success/Berhasil`
          })
            continue
          }

          dictionaryData.push({
            jenis_transaksi: jenisTransaksi,
            rc: rc,
          rc_description: rcDescription || null,
            error_type: errorType,
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
        const headers: string[] = []

        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col })
          const cell = worksheet[cellAddress]
          if (cell && cell.v) {
            headers.push(String(cell.v).trim())
          }
        }

      // Validate columns - now expect 3-4 columns (with optional RC Description)
        if (headers.length < 3 || headers.length > 4) {
          return NextResponse.json(
            {
              success: false,
            message: `Invalid column count. Expected 3-4 columns (Jenis Transaksi, RC, S/N, [RC Description]), got ${headers.length}`,
            } as ApiResponse,
            { status: 400 }
          )
        }

        // Check required columns (case-insensitive)
        const normalizedHeaders = headers.map((h) => h.toLowerCase())
      const requiredColumns = ['jenis transaksi', 'rc', 's/n']
      const optionalColumns = ['rc description']

        const missingColumns = requiredColumns.filter(
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

        // Find column indices
        const jenisTransaksiIndex = normalizedHeaders.indexOf('jenis transaksi')
        const rcIndex = normalizedHeaders.indexOf('rc')
      const snIndex = normalizedHeaders.indexOf('s/n')
      const rcDescriptionIndex = normalizedHeaders.includes('rc description') 
        ? normalizedHeaders.indexOf('rc description') 
        : -1

        // Collect data from rows (skip header row)
        dictionaryData = []
        let consecutiveEmptyRows = 0
        const MAX_CONSECUTIVE_EMPTY = 10 // Stop jika 10 rows berturut-turut kosong

        for (let rowNum = 1; rowNum <= range.e.r; rowNum++) {
        const actualRowNumber = rowNum + 1 // +1 karena rowNum dimulai dari 1 (skip header), tapi user melihat dari row 2
        
          const jenisTransaksiCell =
            worksheet[XLSX.utils.encode_cell({ r: rowNum, c: jenisTransaksiIndex })]
          const rcCell = worksheet[XLSX.utils.encode_cell({ r: rowNum, c: rcIndex })]
        const snCell = worksheet[XLSX.utils.encode_cell({ r: rowNum, c: snIndex })]
          const rcDescriptionCell = rcDescriptionIndex >= 0 
            ? worksheet[XLSX.utils.encode_cell({ r: rowNum, c: rcDescriptionIndex })]
            : null

          const jenisTransaksi =
            jenisTransaksiCell && jenisTransaksiCell.v
              ? String(jenisTransaksiCell.v).trim()
              : ''
          const rc = rcCell && rcCell.v ? String(rcCell.v).trim() : ''
        const rawSn =
          snCell && snCell.v ? String(snCell.v).trim().toUpperCase() : ''
          const rcDescription = rcDescriptionCell && rcDescriptionCell.v
            ? String(rcDescriptionCell.v).trim()
            : null

        // Basic validation - skip completely empty rows (hanya cek apakah ada data)
        const hasData = jenisTransaksi !== '' || rc !== ''

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

        // Map S/N values to error_type
          let errorType: 'S' | 'N' | 'Sukses' | null = null
        if (rawSn === 'S') {
            errorType = 'S'
        } else if (rawSn === 'N') {
            errorType = 'N'
          } else if (
          rawSn === 'SUKSES' ||
          rawSn === 'SUCCESS' ||
          rawSn === 'BERHASIL'
          ) {
            errorType = 'Sukses'
          }

        // Validate row data - skip if missing error_type
          if (!errorType) {
          skippedRows.push({
            rowNumber: actualRowNumber,
            reason: `Kolom S/N tidak valid: "${rawSn || '(kosong)'}". Nilai yang diterima: S, N, Sukses/Success/Berhasil`
          })
            continue
          }

          dictionaryData.push({
            jenis_transaksi: jenisTransaksi,
            rc: rc,
          rc_description: rcDescription || null,
            error_type: errorType,
          })
        }
      }

    // Check if there are skipped rows - fail upload if any rows were skipped
    if (skippedRows.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `Upload gagal: ${skippedRows.length} row(s) memiliki error dan di-skip`,
          data: {
            skippedRows: skippedRows,
            totalSkipped: skippedRows.length,
            totalProcessed: dictionaryData.length,
          },
        } as ApiResponse & { data: { skippedRows: Array<{ rowNumber: number; reason: string }>; totalSkipped: number; totalProcessed: number } },
        { status: 400 }
      )
    }

    if (dictionaryData.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'No valid dictionary data found in the file',
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

      // Use upsert query to handle duplicates
      const { adapter } = await import('@/lib/db')
      const { buildSimpleUpsertQuery } = await import('@/lib/sql-helpers')
      
      let insertQuery = buildSimpleUpsertQuery(
        adapter,
        'response_code_dictionary',
        ['id_app_identifier', 'jenis_transaksi', 'rc', 'rc_description', 'error_type'],
        ['id_app_identifier', 'jenis_transaksi', 'rc'], // conflict columns (unique key)
        ['error_type', 'rc_description'] // update columns
      )
      
      // For MySQL, we need to handle COALESCE manually in a custom query
      // For PostgreSQL, EXCLUDED will work fine
      if (adapter.getDatabaseType() === 'mysql') {
        // MySQL: Use COALESCE to preserve existing rc_description if new one is null
        insertQuery = insertQuery.replace(
          /rc_description = VALUES\(rc_description\)/,
          'rc_description = COALESCE(VALUES(rc_description), rc_description)'
        )
      } else {
        // PostgreSQL: Use COALESCE with EXCLUDED and table name to avoid ambiguous reference
        const quotedTable = adapter.quoteIdentifier('response_code_dictionary')
        insertQuery = insertQuery.replace(
          /"rc_description" = EXCLUDED\."rc_description"/,
          `"rc_description" = COALESCE(EXCLUDED."rc_description", ${quotedTable}."rc_description")`
        )
      }

      for (const entry of dictionaryData) {
          await connection.execute(insertQuery, [
            applicationId,
            entry.jenis_transaksi,
            entry.rc,
          entry.rc_description,
            entry.error_type,
          ])
      }

      // After uploading dictionary, remap unmapped_rc entries that now have a match
      // Get all unmapped_rc entries for this application
      const [unmappedRcs]: any = await connection.execute(
        `SELECT id, id_app_identifier, jenis_transaksi, rc, status_transaksi
         FROM unmapped_rc
         WHERE id_app_identifier = ?`,
        [applicationId]
      )

      let remappedCount = 0
      for (const unmappedRc of unmappedRcs) {
        // Check if this RC now exists in the dictionary
        if (!unmappedRc.jenis_transaksi || unmappedRc.jenis_transaksi === '') {
          continue
        }
        
        const [dictionaryMatch]: any = await connection.execute(
          `SELECT error_type FROM response_code_dictionary 
           WHERE id_app_identifier = ? AND jenis_transaksi = ? AND rc = ?`,
          [applicationId, unmappedRc.jenis_transaksi, unmappedRc.rc]
        )
        
        // If found in dictionary, update app_success_rate and remove from unmapped_rc
        if (dictionaryMatch.length > 0) {
          const error_type = dictionaryMatch[0].error_type
          
          // Update all app_success_rate entries that match this RC
          // Exact match: id_app_identifier + jenis_transaksi + rc
          const updateQuery = `UPDATE app_success_rate 
           SET error_type = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id_app_identifier = ? 
           AND rc = ? 
           AND jenis_transaksi = ?
           AND (error_type IS NULL OR (status_transaksi = 'pending' AND error_type = 'S') OR (status_transaksi = 'suspect' AND error_type = 'S') OR (status_transaksi = 'cancelled' AND error_type = 'S'))`
          
          await connection.execute(updateQuery, [error_type, applicationId, unmappedRc.rc, unmappedRc.jenis_transaksi])
          
          // Delete from unmapped_rc
          await connection.execute(
            `DELETE FROM unmapped_rc WHERE id = ?`,
            [unmappedRc.id]
          )
          
          remappedCount++
        }
      }

      // Log audit event
      await logAuditEvent(
        session.userId,
        session.username,
        'DICTIONARY_UPLOADED',
        'response_code_dictionary',
        applicationId.toString(),
        `Uploaded dictionary for application: ${applicationName}. ${dictionaryData.length} entries processed.${remappedCount > 0 ? ` ${remappedCount} unmapped RC(s) auto-remapped.` : ''}`,
        getClientIp(request),
        getUserAgent(request)
      )

      return NextResponse.json({
        success: true,
        message: `Dictionary uploaded successfully. ${dictionaryData.length} entries processed.${remappedCount > 0 ? ` ${remappedCount} unmapped RC(s) have been automatically remapped.` : ''}`,
        data: {
          entriesProcessed: dictionaryData.length,
          remappedCount: remappedCount,
          applicationId: applicationId,
          applicationName: applicationName,
        },
      } as ApiResponse)
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
    
    console.error('Error uploading dictionary:', error)
      return NextResponse.json(
        {
          success: false,
        message: 'Error processing dictionary file: ' + error.message,
        } as ApiResponse,
        { status: 500 }
      )
  }
}

