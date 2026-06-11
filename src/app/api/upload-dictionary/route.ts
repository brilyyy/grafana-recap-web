import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { db } from '@/db'
import { requireAuth } from '@/lib/auth'
import { logAuditEvent, getClientIp, getUserAgent } from '@/lib/audit'
import { env } from '@/env'
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
    const session = await requireAuth(request)
    const formData = await request.formData()
    const file = formData.get('dictionaryFile') as File
    const selectedApplicationId = formData.get('selectedApplicationId') as string

    // Check if file was uploaded
    if (!file) {
      return NextResponse.json(
        { success: false, message: 'No file uploaded' } as ApiResponse,
        { status: 400 }
      )
    }

    // Validate application ID
    if (!selectedApplicationId || isNaN(parseInt(selectedApplicationId))) {
      return NextResponse.json(
        { success: false, message: 'Valid application selection is required' } as ApiResponse,
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
      const text = await file.text()
      const rows = parseCSV(text)

      if (rows.length === 0) {
        return NextResponse.json(
          { success: false, message: 'CSV file is empty' } as ApiResponse,
          { status: 400 }
        )
      }

      const headers = rows[0].map(h => h.trim())

      if (headers.length < 3 || headers.length > 4) {
        return NextResponse.json(
          { success: false, message: `Invalid column count. Expected 3-4 columns, got ${headers.length}` } as ApiResponse,
          { status: 400 }
        )
      }

      const normalizedHeaders = headers.map((h) => h.toLowerCase())
      const requiredColumns = ['jenis transaksi', 'rc', 's/n']
      const missingColumns = requiredColumns.filter((required) => !normalizedHeaders.includes(required))

      if (missingColumns.length > 0) {
        return NextResponse.json(
          { success: false, message: `Missing required columns: ${missingColumns.join(', ')}` } as ApiResponse,
          { status: 400 }
        )
      }

      const jenisTransaksiIndex = normalizedHeaders.indexOf('jenis transaksi')
      const rcIndex = normalizedHeaders.indexOf('rc')
      const snIndex = normalizedHeaders.indexOf('s/n')
      const rcDescriptionIndex = normalizedHeaders.includes('rc description')
        ? normalizedHeaders.indexOf('rc description') : -1

      for (let rowNum = 1; rowNum < rows.length; rowNum++) {
        const row = rows[rowNum]
        const actualRowNumber = rowNum + 1

        if (row.length < 3) {
          skippedRows.push({ rowNumber: actualRowNumber, reason: `Only ${row.length} columns` })
          continue
        }

        const jenisTransaksi = (row[jenisTransaksiIndex] || '').trim()
        const rc = (row[rcIndex] || '').trim()
        const rawSn = (row[snIndex] || '').trim().toUpperCase()
        const rcDescription = rcDescriptionIndex >= 0 && row[rcDescriptionIndex]
          ? (row[rcDescriptionIndex] || '').trim() : null

        const hasData = jenisTransaksi !== '' || rc !== ''
        if (!hasData) continue

        let errorType: 'S' | 'N' | 'Sukses' | null = null
        if (rawSn === 'S') errorType = 'S'
        else if (rawSn === 'N') errorType = 'N'
        else if (rawSn === 'SUKSES' || rawSn === 'SUCCESS' || rawSn === 'BERHASIL') errorType = 'Sukses'

        if (!errorType) {
          skippedRows.push({ rowNumber: actualRowNumber, reason: `Invalid S/N: "${rawSn || '(empty)'}"` })
          continue
        }

        dictionaryData.push({ jenis_transaksi: jenisTransaksi, rc, rc_description: rcDescription || null, error_type: errorType })
      }
    } else {
      // Parse Excel file
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      const workbook = XLSX.read(buffer, { type: 'buffer' })

      if (workbook.SheetNames.length === 0) {
        return NextResponse.json(
          { success: false, message: 'Excel file contains no worksheets' } as ApiResponse,
          { status: 400 }
        )
      }

      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1')
      const headers: string[] = []

      for (let col = range.s.c; col <= range.e.c; col++) {
        const cell = worksheet[XLSX.utils.encode_cell({ r: 0, c: col })]
        if (cell && cell.v) headers.push(String(cell.v).trim())
      }

      if (headers.length < 3 || headers.length > 4) {
        return NextResponse.json(
          { success: false, message: `Invalid column count. Expected 3-4 columns, got ${headers.length}` } as ApiResponse,
          { status: 400 }
        )
      }

      const normalizedHeaders = headers.map((h) => h.toLowerCase())
      const requiredColumns = ['jenis transaksi', 'rc', 's/n']
      const missingColumns = requiredColumns.filter((required) => !normalizedHeaders.includes(required))

      if (missingColumns.length > 0) {
        return NextResponse.json(
          { success: false, message: `Missing required columns: ${missingColumns.join(', ')}` } as ApiResponse,
          { status: 400 }
        )
      }

      const jenisTransaksiIndex = normalizedHeaders.indexOf('jenis transaksi')
      const rcIndex = normalizedHeaders.indexOf('rc')
      const snIndex = normalizedHeaders.indexOf('s/n')
      const rcDescriptionIndex = normalizedHeaders.includes('rc description')
        ? normalizedHeaders.indexOf('rc description') : -1

      dictionaryData = []
      let consecutiveEmptyRows = 0

      for (let rowNum = 1; rowNum <= range.e.r; rowNum++) {
        const actualRowNumber = rowNum + 1
        const jenisTransaksiCell = worksheet[XLSX.utils.encode_cell({ r: rowNum, c: jenisTransaksiIndex })]
        const rcCell = worksheet[XLSX.utils.encode_cell({ r: rowNum, c: rcIndex })]
        const snCell = worksheet[XLSX.utils.encode_cell({ r: rowNum, c: snIndex })]
        const rcDescriptionCell = rcDescriptionIndex >= 0
          ? worksheet[XLSX.utils.encode_cell({ r: rowNum, c: rcDescriptionIndex })] : null

        const jenisTransaksi = jenisTransaksiCell?.v ? String(jenisTransaksiCell.v).trim() : ''
        const rc = rcCell?.v ? String(rcCell.v).trim() : ''
        const rawSn = snCell?.v ? String(snCell.v).trim().toUpperCase() : ''
        const rcDescription = rcDescriptionCell?.v ? String(rcDescriptionCell.v).trim() : null

        const hasData = jenisTransaksi !== '' || rc !== ''
        if (!hasData) {
          consecutiveEmptyRows++
          if (consecutiveEmptyRows >= 10) break
          continue
        }
        consecutiveEmptyRows = 0

        let errorType: 'S' | 'N' | 'Sukses' | null = null
        if (rawSn === 'S') errorType = 'S'
        else if (rawSn === 'N') errorType = 'N'
        else if (rawSn === 'SUKSES' || rawSn === 'SUCCESS' || rawSn === 'BERHASIL') errorType = 'Sukses'

        if (!errorType) {
          skippedRows.push({ rowNumber: actualRowNumber, reason: `Invalid S/N: "${rawSn || '(empty)'}"` })
          continue
        }

        dictionaryData.push({ jenis_transaksi: jenisTransaksi, rc, rc_description: rcDescription || null, error_type: errorType })
      }
    }

    if (skippedRows.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `Upload failed: ${skippedRows.length} row(s) have errors`,
          data: { skippedRows, totalSkipped: skippedRows.length, totalProcessed: dictionaryData.length },
        } as ApiResponse,
        { status: 400 }
      )
    }

    if (dictionaryData.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No valid dictionary data found in the file' } as ApiResponse,
        { status: 400 }
      )
    }

    // Verify application exists
    const appResult = await db.execute(sql`SELECT app_name FROM app_identifier WHERE id = ${applicationId}`)
    if (appResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Selected application does not exist' } as ApiResponse,
        { status: 400 }
      )
    }
    const applicationName = (appResult.rows[0] as any).app_name

    // Insert dictionary entries with upsert
    for (const entry of dictionaryData) {
      await db.execute(sql`
        INSERT INTO response_code_dictionary (id_app_identifier, jenis_transaksi, rc, rc_description, error_type)
        VALUES (${applicationId}, ${entry.jenis_transaksi}, ${entry.rc}, ${entry.rc_description}, ${entry.error_type})
        ON CONFLICT (id_app_identifier, jenis_transaksi, rc)
        DO UPDATE SET error_type = EXCLUDED.error_type, rc_description = COALESCE(EXCLUDED.rc_description, response_code_dictionary.rc_description)
      `)
    }

    // After uploading dictionary, remap unmapped_rc entries that now have a match
    const unmappedRcs = await db.execute(sql`
      SELECT id, id_app_identifier, jenis_transaksi, rc, status_transaksi
      FROM unmapped_rc WHERE id_app_identifier = ${applicationId}
    `)

    let remappedCount = 0
    for (const unmappedRc of unmappedRcs.rows as any[]) {
      if (!unmappedRc.jenis_transaksi || unmappedRc.jenis_transaksi === '') continue

      const dictMatch = await db.execute(sql`
        SELECT error_type FROM response_code_dictionary
        WHERE id_app_identifier = ${applicationId} AND jenis_transaksi = ${unmappedRc.jenis_transaksi} AND rc = ${unmappedRc.rc}
      `)

      if (dictMatch.rows.length > 0) {
        const errorType = (dictMatch.rows[0] as any).error_type
        await db.execute(sql`
          UPDATE app_success_rate SET error_type = ${errorType}, updated_at = CURRENT_TIMESTAMP
          WHERE id_app_identifier = ${applicationId} AND rc = ${unmappedRc.rc} AND jenis_transaksi = ${unmappedRc.jenis_transaksi}
            AND (error_type IS NULL OR (status_transaksi = 'pending' AND error_type = 'S') OR (status_transaksi = 'suspect' AND error_type = 'S') OR (status_transaksi = 'cancelled' AND error_type = 'S'))
        `)
        await db.execute(sql`DELETE FROM unmapped_rc WHERE id = ${unmappedRc.id}`)
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
        remappedCount,
        applicationId,
        applicationName,
      },
    } as ApiResponse)
  } catch (error: any) {
    if (error.message?.includes('Unauthorized') || error.message?.includes('Forbidden')) {
      return NextResponse.json(
        { success: false, message: error.message } as ApiResponse,
        { status: 403 }
      )
    }

    console.error('Error uploading dictionary:', error)
    return NextResponse.json(
      { success: false, message: 'Error processing dictionary file: ' + error.message } as ApiResponse,
      { status: 500 }
    )
  }
}
