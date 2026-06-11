import { createFileRoute } from '@tanstack/react-router'
import { sql } from 'drizzle-orm'
import * as XLSX from 'xlsx'
import { db } from '@/db'
import { getClientIp, getUserAgent, logAuditEvent } from '@/lib/audit'
import { requireAuth } from '@/lib/auth'
import type { ApiResponse, SuccessRateEntry } from '@/types'

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
        i++
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

  return lines.map((line) => {
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

export const Route = createFileRoute('/api/upload-success-rate')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const session = await requireAuth(request)
          const formData = await request.formData()
          const file = formData.get('successRateFile') as File
          const selectedApplicationId = formData.get('selectedApplicationId') as string

          if (!file) {
            return Response.json({ success: false, message: 'No file uploaded' } as ApiResponse, { status: 400 })
          }

          if (!selectedApplicationId || Number.isNaN(parseInt(selectedApplicationId, 10))) {
            return Response.json(
              { success: false, message: 'Valid application selection is required' } as ApiResponse,
              { status: 400 },
            )
          }

          const applicationId = parseInt(selectedApplicationId, 10)
          const isCSV = file.name.toLowerCase().endsWith('.csv')
          let headers: string[] = []
          let successRateData: SuccessRateEntry[] = []
          const skippedRows: Array<{ rowNumber: number; reason: string }> = []

          if (isCSV) {
            const text = await file.text()
            const rows = parseCSV(text)

            if (rows.length === 0) {
              return Response.json({ success: false, message: 'CSV file is empty' } as ApiResponse, { status: 400 })
            }

            headers = rows[0].map((h) => h.trim())

            if (
              headers.length < requiredColumns.length ||
              headers.length > requiredColumns.length + optionalColumns.length
            ) {
              return Response.json(
                {
                  success: false,
                  message: `Invalid column count. Expected ${requiredColumns.length}-${requiredColumns.length + optionalColumns.length} columns, got ${headers.length}`,
                } as ApiResponse,
                { status: 400 },
              )
            }

            const normalizedHeaders = headers.map((h) => h.toLowerCase())
            const normalizedRequired = requiredColumns.map((r) => r.toLowerCase())
            const missingColumns = normalizedRequired.filter((required) => !normalizedHeaders.includes(required))

            if (missingColumns.length > 0) {
              return Response.json(
                { success: false, message: `Missing required columns: ${missingColumns.join(', ')}` } as ApiResponse,
                { status: 400 },
              )
            }

            const columnIndices: Record<string, number> = {}
            requiredColumns.forEach((colName) => {
              columnIndices[colName] = normalizedHeaders.indexOf(colName.toLowerCase())
            })
            optionalColumns.forEach((colName) => {
              const idx = normalizedHeaders.indexOf(colName.toLowerCase())
              if (idx >= 0) columnIndices[colName] = idx
            })

            for (let rowNum = 1; rowNum < rows.length; rowNum++) {
              const row = rows[rowNum]
              const actualRowNumber = rowNum + 1

              if (row.length < requiredColumns.length) {
                skippedRows.push({ rowNumber: actualRowNumber, reason: `Only ${row.length} columns` })
                continue
              }

              const rowData: Record<string, string> = {}
              requiredColumns.forEach((colName) => {
                rowData[colName] = (row[columnIndices[colName]] || '').trim()
              })
              optionalColumns.forEach((colName) => {
                if (columnIndices[colName] !== undefined) rowData[colName] = (row[columnIndices[colName]] || '').trim()
              })

              const hasData = ['Tanggal Transaksi', 'Jenis Transaksi'].some(
                (col) => rowData[col] && rowData[col] !== '',
              )
              if (!hasData) continue

              let tanggalTransaksi: string | null = null
              let bulan: string | null = null
              let tahun: number | null = null
              const dateStr = rowData['Tanggal Transaksi']

              if (dateStr) {
                const parts = dateStr.split('/')
                if (parts.length === 3) {
                  const day = parseInt(parts[0], 10),
                    month = parseInt(parts[1], 10),
                    year = parseInt(parts[2], 10)
                  if (!Number.isNaN(day) && !Number.isNaN(month) && !Number.isNaN(year)) {
                    tanggalTransaksi = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                    bulan = String(month)
                    tahun = year
                  }
                }
                if (!tanggalTransaksi) {
                  const isoParts = dateStr.split('-')
                  if (isoParts.length === 3) {
                    const year = parseInt(isoParts[0], 10),
                      month = parseInt(isoParts[1], 10),
                      day = parseInt(isoParts[2], 10)
                    if (!Number.isNaN(year) && !Number.isNaN(month) && !Number.isNaN(day)) {
                      tanggalTransaksi = dateStr
                      bulan = String(month)
                      tahun = year
                    }
                  }
                }
                if (!tanggalTransaksi) {
                  const dateValue = new Date(dateStr)
                  if (!Number.isNaN(dateValue.getTime())) {
                    tanggalTransaksi = `${dateValue.getFullYear()}-${String(dateValue.getMonth() + 1).padStart(2, '0')}-${String(dateValue.getDate()).padStart(2, '0')}`
                    bulan = String(dateValue.getMonth() + 1)
                    tahun = dateValue.getFullYear()
                  }
                }
              }

              if (!tanggalTransaksi || !bulan || !tahun) {
                skippedRows.push({ rowNumber: actualRowNumber, reason: `Invalid date: "${dateStr || '(empty)'}"` })
                continue
              }

              const jenisTransaksi = rowData['Jenis Transaksi']?.trim() || null
              if (!jenisTransaksi || jenisTransaksi === '') {
                skippedRows.push({ rowNumber: actualRowNumber, reason: 'Jenis Transaksi required' })
                continue
              }

              let rc = rowData.RC?.trim() || null
              if (rc === '') rc = null
              const rcDescription = rowData['RC Description']?.trim() || null
              const rawStatus = rowData['Status Transaksi']?.trim() || null
              const statusTransaksi: string | null = rawStatus && rawStatus !== '' ? rawStatus : null

              const rcValue = rc?.trim() || ''
              const isRcEmpty = !rcValue || rcValue === '' || rcValue === '-'
              if (isRcEmpty) {
                const normDesc = rcDescription?.toLowerCase()?.trim() || ''
                const normStatus = statusTransaksi?.toLowerCase()?.trim() || ''
                if (
                  normDesc === 'sukses' ||
                  normDesc === 'success' ||
                  normDesc === 'berhasil' ||
                  normStatus === 'sukses' ||
                  normStatus === 'success' ||
                  normStatus === 'berhasil'
                ) {
                  rc = '00'
                }
              }

              successRateData.push({
                tanggal_transaksi: tanggalTransaksi,
                bulan: bulan!,
                tahun: tahun!,
                jenis_transaksi: jenisTransaksi!,
                rc,
                rc_description: rcDescription,
                total_transaksi: rowData['total transaksi'] ? parseInt(rowData['total transaksi'], 10) : null,
                total_nominal: rowData['Total Nominal'] ? parseFloat(rowData['Total Nominal']) : null,
                total_biaya_admin: rowData['Total Biaya Admin'] ? parseFloat(rowData['Total Biaya Admin']) : null,
                status_transaksi: statusTransaksi,
                error_type: null,
                id_app_identifier: applicationId,
              })
            }
          } else {
            const bytes = await file.arrayBuffer()
            const buffer = Buffer.from(bytes)
            const workbook = XLSX.read(buffer, { type: 'buffer' })

            if (workbook.SheetNames.length === 0) {
              return Response.json({ success: false, message: 'Excel file contains no worksheets' } as ApiResponse, {
                status: 400,
              })
            }

            const worksheet = workbook.Sheets[workbook.SheetNames[0]]
            const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1')
            headers = []

            for (let col = range.s.c; col <= range.e.c; col++) {
              const cell = worksheet[XLSX.utils.encode_cell({ r: 0, c: col })]
              if (cell?.v) headers.push(String(cell.v).trim())
            }

            if (
              headers.length < requiredColumns.length ||
              headers.length > requiredColumns.length + optionalColumns.length
            ) {
              return Response.json(
                {
                  success: false,
                  message: `Invalid column count. Expected ${requiredColumns.length}-${requiredColumns.length + optionalColumns.length} columns, got ${headers.length}`,
                } as ApiResponse,
                { status: 400 },
              )
            }

            const normalizedHeaders = headers.map((h) => h.toLowerCase())
            const normalizedRequired = requiredColumns.map((r) => r.toLowerCase())
            const missingColumns = normalizedRequired.filter((required) => !normalizedHeaders.includes(required))

            if (missingColumns.length > 0) {
              return Response.json(
                { success: false, message: `Missing required columns: ${missingColumns.join(', ')}` } as ApiResponse,
                { status: 400 },
              )
            }

            const columnIndices: Record<string, number> = {}
            requiredColumns.forEach((colName) => {
              columnIndices[colName] = normalizedHeaders.indexOf(colName.toLowerCase())
            })
            optionalColumns.forEach((colName) => {
              const idx = normalizedHeaders.indexOf(colName.toLowerCase())
              if (idx >= 0) columnIndices[colName] = idx
            })

            successRateData = []
            let consecutiveEmptyRows = 0

            for (let rowNum = 1; rowNum <= range.e.r; rowNum++) {
              const actualRowNumber = rowNum + 1
              const rowData: Record<string, string> = {}

              requiredColumns.forEach((colName) => {
                const cell = worksheet[XLSX.utils.encode_cell({ r: rowNum, c: columnIndices[colName] })]
                rowData[colName] = cell?.v ? String(cell.v).trim() : ''
              })
              optionalColumns.forEach((colName) => {
                if (columnIndices[colName] !== undefined) {
                  const cell = worksheet[XLSX.utils.encode_cell({ r: rowNum, c: columnIndices[colName] })]
                  rowData[colName] = cell?.v ? String(cell.v).trim() : ''
                }
              })

              const hasData = ['Tanggal Transaksi', 'Jenis Transaksi'].some(
                (col) => rowData[col] && rowData[col] !== '',
              )
              if (!hasData) {
                consecutiveEmptyRows++
                if (consecutiveEmptyRows >= 10) break
                continue
              }
              consecutiveEmptyRows = 0

              let tanggalTransaksi: string | null = null
              let bulan: string | null = null
              let tahun: number | null = null
              const rawCell = worksheet[XLSX.utils.encode_cell({ r: rowNum, c: columnIndices['Tanggal Transaksi'] })]

              if (rawCell) {
                let dateValue: Date | null = null
                if (rawCell.t === 'd') {
                  dateValue = rawCell.v
                } else if (rawCell.t === 'n') {
                  const parsed = XLSX.SSF.parse_date_code(rawCell.v)
                  if (parsed) dateValue = new Date(parsed.y, parsed.m - 1, parsed.d)
                } else {
                  const dateStr = String(rawCell.v).trim()
                  const parts = dateStr.split('/')
                  if (parts.length === 3) {
                    const d = parseInt(parts[0], 10),
                      m = parseInt(parts[1], 10),
                      y = parseInt(parts[2], 10)
                    if (!Number.isNaN(d) && !Number.isNaN(m) && !Number.isNaN(y)) dateValue = new Date(y, m - 1, d)
                  }
                  if (!dateValue || Number.isNaN(dateValue.getTime())) {
                    const isoParts = dateStr.split('-')
                    if (isoParts.length === 3) {
                      const y = parseInt(isoParts[0], 10),
                        m = parseInt(isoParts[1], 10),
                        d = parseInt(isoParts[2], 10)
                      if (!Number.isNaN(y) && !Number.isNaN(m) && !Number.isNaN(d)) dateValue = new Date(y, m - 1, d)
                    }
                  }
                  if (!dateValue || Number.isNaN(dateValue.getTime())) dateValue = new Date(rawCell.v)
                }

                if (dateValue && !Number.isNaN(dateValue.getTime())) {
                  tanggalTransaksi = `${dateValue.getFullYear()}-${String(dateValue.getMonth() + 1).padStart(2, '0')}-${String(dateValue.getDate()).padStart(2, '0')}`
                  bulan = String(dateValue.getMonth() + 1)
                  tahun = dateValue.getFullYear()
                } else {
                  skippedRows.push({ rowNumber: actualRowNumber, reason: `Invalid date: "${rawCell.v || '(empty)'}"` })
                  continue
                }
              } else {
                skippedRows.push({ rowNumber: actualRowNumber, reason: 'Tanggal Transaksi empty' })
                continue
              }

              if (!tanggalTransaksi || !bulan || !tahun) {
                skippedRows.push({ rowNumber: actualRowNumber, reason: 'Invalid date' })
                continue
              }

              const jenisTransaksi = rowData['Jenis Transaksi']?.trim() || null
              if (!jenisTransaksi || jenisTransaksi === '') {
                skippedRows.push({ rowNumber: actualRowNumber, reason: 'Jenis Transaksi required' })
                continue
              }

              let rc = rowData.RC?.trim() || null
              if (rc === '') rc = null
              const rcDescription = rowData['RC Description']?.trim() || null
              const rawStatus = rowData['Status Transaksi']?.trim() || null
              const statusTransaksi: string | null = rawStatus && rawStatus !== '' ? rawStatus : null

              const rcValue = rc?.trim() || ''
              const isRcEmpty = !rcValue || rcValue === '' || rcValue === '-'
              if (isRcEmpty) {
                const normDesc = rcDescription?.toLowerCase()?.trim() || ''
                const normStatus = statusTransaksi?.toLowerCase()?.trim() || ''
                if (
                  normDesc === 'sukses' ||
                  normDesc === 'success' ||
                  normDesc === 'berhasil' ||
                  normStatus === 'sukses' ||
                  normStatus === 'success' ||
                  normStatus === 'berhasil'
                ) {
                  rc = '00'
                }
              }

              successRateData.push({
                tanggal_transaksi: tanggalTransaksi!,
                bulan: bulan!,
                tahun: tahun!,
                jenis_transaksi: jenisTransaksi!,
                rc,
                rc_description: rcDescription,
                total_transaksi: rowData['total transaksi'] ? parseInt(rowData['total transaksi'], 10) : null,
                total_nominal: rowData['Total Nominal'] ? parseFloat(rowData['Total Nominal']) : null,
                total_biaya_admin: rowData['Total Biaya Admin'] ? parseFloat(rowData['Total Biaya Admin']) : null,
                status_transaksi: statusTransaksi,
                error_type: null,
                id_app_identifier: applicationId,
              })
            }
          }

          if (skippedRows.length > 0) {
            return Response.json(
              {
                success: false,
                message: `Upload failed: ${skippedRows.length} row(s) have errors`,
                data: { skippedRows, totalSkipped: skippedRows.length, totalProcessed: successRateData.length },
              } as ApiResponse,
              { status: 400 },
            )
          }

          if (successRateData.length === 0) {
            return Response.json(
              { success: false, message: 'No valid success rate data found in the file' } as ApiResponse,
              { status: 400 },
            )
          }

          const appResult = await db.execute(sql`SELECT app_name FROM app_identifier WHERE id = ${applicationId}`)
          if (appResult.rows.length === 0) {
            return Response.json({ success: false, message: 'Selected application does not exist' } as ApiResponse, {
              status: 400,
            })
          }
          const applicationName = (appResult.rows[0] as any).app_name

          await db.transaction(async (tx) => {
            for (const entry of successRateData) {
              let foundInDictionary = false
              const rcValue = entry.rc?.trim() || ''
              const isRcEmpty = !rcValue || rcValue === '' || rcValue === '-'

              if (!isRcEmpty && entry.jenis_transaksi) {
                const dictResult = await tx.execute(sql`
                  SELECT error_type FROM response_code_dictionary
                  WHERE id_app_identifier = ${applicationId} AND jenis_transaksi = ${entry.jenis_transaksi} AND rc = ${entry.rc}
                `)

                if (dictResult.rows.length > 0) {
                  entry.error_type = (dictResult.rows[0] as any).error_type
                  foundInDictionary = true
                }

                if (!foundInDictionary) {
                  await tx.execute(sql`
                    INSERT INTO unmapped_rc (id_app_identifier, jenis_transaksi, rc, rc_description, status_transaksi, error_type)
                    VALUES (${applicationId}, ${entry.jenis_transaksi}, ${entry.rc}, ${entry.rc_description}, ${entry.status_transaksi}, NULL)
                    ON CONFLICT (id_app_identifier, jenis_transaksi, rc) DO NOTHING
                  `)
                }
              } else {
                const normDesc = entry.rc_description?.toLowerCase()?.trim() || ''
                const normStatus = entry.status_transaksi?.toLowerCase()?.trim() || ''
                if (
                  normDesc === 'sukses' ||
                  normDesc === 'success' ||
                  normDesc === 'berhasil' ||
                  normStatus === 'sukses' ||
                  normStatus === 'success' ||
                  normStatus === 'berhasil'
                ) {
                  entry.rc = '00'
                  entry.error_type = 'Sukses'
                } else {
                  entry.error_type = null
                }
              }
            }

            for (const entry of successRateData) {
              await tx.execute(sql`
                INSERT INTO app_success_rate (
                  id_app_identifier, tanggal_transaksi, bulan, tahun, jenis_transaksi, rc, rc_description,
                  total_transaksi, total_nominal, total_biaya_admin, status_transaksi, error_type
                ) VALUES (
                  ${entry.id_app_identifier}, ${entry.tanggal_transaksi}, ${entry.bulan}, ${entry.tahun},
                  ${entry.jenis_transaksi}, ${entry.rc}, ${entry.rc_description},
                  ${entry.total_transaksi}, ${entry.total_nominal}, ${entry.total_biaya_admin},
                  ${entry.status_transaksi}, ${entry.error_type}
                )
              `)
            }
          })

          await logAuditEvent(
            session.userId,
            session.username,
            'SUCCESS_RATE_UPLOADED',
            'app_success_rate',
            applicationId.toString(),
            `Uploaded success rate for application: ${applicationName}. ${successRateData.length} entries processed.`,
            getClientIp(request),
            getUserAgent(request),
          )

          return Response.json({
            success: true,
            message: `Success rate document uploaded successfully. ${successRateData.length} entries processed.`,
            data: { entriesProcessed: successRateData.length, applicationId, applicationName },
          } as ApiResponse)
        } catch (error: any) {
          if (error.message?.includes('Unauthorized') || error.message?.includes('Forbidden')) {
            return Response.json({ success: false, message: error.message } as ApiResponse, { status: 403 })
          }

          console.error('Error uploading success rate:', error)
          return Response.json(
            { success: false, message: `Error processing success rate file: ${error.message}` } as ApiResponse,
            { status: 500 },
          )
        }
      },
    },
  },
})
