import { createFileRoute } from '@tanstack/react-router'
import { sql } from 'drizzle-orm'
import * as XLSX from 'xlsx'
import { db } from '@/db'
import { getClientIp, getUserAgent, logAuditEvent } from '@/lib/audit'
import { requireAuth } from '@/lib/auth'

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
      } else inQuotes = !inQuotes
    } else if (char === '\n' || char === '\r') {
      if (!inQuotes) {
        if (currentLine.trim()) {
          lines.push(currentLine)
          currentLine = ''
        }
        if (char === '\r' && nextChar === '\n') i++
      } else currentLine += char
    } else currentLine += char
  }
  if (currentLine.trim()) lines.push(currentLine)
  return lines.map((line) => {
    const fields: string[] = []
    let currentField = ''
    let inFieldQuotes = false
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        if (inFieldQuotes && line[i + 1] === '"') {
          currentField += '"'
          i++
        } else inFieldQuotes = !inFieldQuotes
      } else if (char === ',' && !inFieldQuotes) {
        fields.push(currentField.trim())
        currentField = ''
      } else currentField += char
    }
    fields.push(currentField.trim())
    return fields
  })
}

export const Route = createFileRoute('/api/upload-dictionary')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const session = await requireAuth(request)
          const formData = await request.formData()
          const file = formData.get('dictionaryFile') as File
          const selectedApplicationId = formData.get('selectedApplicationId') as string

          if (!file) return Response.json({ success: false, message: 'No file uploaded' }, { status: 400 })
          if (!selectedApplicationId || Number.isNaN(parseInt(selectedApplicationId, 10)))
            return Response.json(
              { success: false, message: 'Valid application selection is required' },
              { status: 400 },
            )

          const applicationId = selectedApplicationId
          const isCSV = file.name.toLowerCase().endsWith('.csv')
          const dictionaryData: Array<{
            jenis_transaksi: string
            rc: string
            rc_description: string | null
            error_type: 'S' | 'N' | 'Sukses'
          }> = []
          const skippedRows: Array<{ rowNumber: number; reason: string }> = []

          if (isCSV) {
            const text = await file.text()
            const rows = parseCSV(text)
            if (rows.length === 0)
              return Response.json({ success: false, message: 'CSV file is empty' }, { status: 400 })
            const headers = rows[0].map((h) => h.trim().toLowerCase())
            const jtIdx = headers.indexOf('jenis transaksi')
            const rcIdx = headers.indexOf('rc')
            const snIdx = headers.indexOf('s/n')
            const descIdx = headers.indexOf('rc description')
            if (jtIdx < 0 || rcIdx < 0 || snIdx < 0)
              return Response.json({ success: false, message: 'Missing required columns' }, { status: 400 })
            for (let i = 1; i < rows.length; i++) {
              const row = rows[i]
              const jt = (row[jtIdx] || '').trim()
              const rc = (row[rcIdx] || '').trim()
              const sn = (row[snIdx] || '').trim().toUpperCase()
              const desc = descIdx >= 0 ? (row[descIdx] || '').trim() : null
              if (!jt && !rc) continue
              let et: 'S' | 'N' | 'Sukses' | null = null
              if (sn === 'S') et = 'S'
              else if (sn === 'N') et = 'N'
              else if (sn === 'SUKSES' || sn === 'SUCCESS' || sn === 'BERHASIL') et = 'Sukses'
              if (!et) {
                skippedRows.push({ rowNumber: i + 1, reason: `Invalid S/N: "${sn}"` })
                continue
              }
              dictionaryData.push({ jenis_transaksi: jt, rc, rc_description: desc || null, error_type: et })
            }
          } else {
            const bytes = await file.arrayBuffer()
            const workbook = XLSX.read(Buffer.from(bytes), { type: 'buffer' })
            if (workbook.SheetNames.length === 0)
              return Response.json({ success: false, message: 'No worksheets' }, { status: 400 })
            const ws = workbook.Sheets[workbook.SheetNames[0]]
            const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
            const headers: string[] = []
            for (let c = range.s.c; c <= range.e.c; c++) {
              const cell = ws[XLSX.utils.encode_cell({ r: 0, c })]
              if (cell?.v) headers.push(String(cell.v).trim().toLowerCase())
            }
            const jtIdx = headers.indexOf('jenis transaksi')
            const rcIdx = headers.indexOf('rc')
            const snIdx = headers.indexOf('s/n')
            const descIdx = headers.indexOf('rc description')
            if (jtIdx < 0 || rcIdx < 0 || snIdx < 0)
              return Response.json({ success: false, message: 'Missing required columns' }, { status: 400 })
            for (let r = 1; r <= range.e.r; r++) {
              const jt = ws[XLSX.utils.encode_cell({ r, c: jtIdx })]?.v
                ? String(ws[XLSX.utils.encode_cell({ r, c: jtIdx })].v).trim()
                : ''
              const rc = ws[XLSX.utils.encode_cell({ r, c: rcIdx })]?.v
                ? String(ws[XLSX.utils.encode_cell({ r, c: rcIdx })].v).trim()
                : ''
              const sn = ws[XLSX.utils.encode_cell({ r, c: snIdx })]?.v
                ? String(ws[XLSX.utils.encode_cell({ r, c: snIdx })].v)
                    .trim()
                    .toUpperCase()
                : ''
              const desc =
                descIdx >= 0 && ws[XLSX.utils.encode_cell({ r, c: descIdx })]?.v
                  ? String(ws[XLSX.utils.encode_cell({ r, c: descIdx })].v).trim()
                  : null
              if (!jt && !rc) continue
              let et: 'S' | 'N' | 'Sukses' | null = null
              if (sn === 'S') et = 'S'
              else if (sn === 'N') et = 'N'
              else if (sn === 'SUKSES' || sn === 'SUCCESS' || sn === 'BERHASIL') et = 'Sukses'
              if (!et) {
                skippedRows.push({ rowNumber: r + 1, reason: `Invalid S/N: "${sn}"` })
                continue
              }
              dictionaryData.push({ jenis_transaksi: jt, rc, rc_description: desc || null, error_type: et })
            }
          }

          if (skippedRows.length > 0)
            return Response.json(
              { success: false, message: `${skippedRows.length} row(s) have errors`, data: { skippedRows } },
              { status: 400 },
            )
          if (dictionaryData.length === 0)
            return Response.json({ success: false, message: 'No valid data' }, { status: 400 })

          const appResult = await db.execute(sql`SELECT app_name FROM app_identifier WHERE id = ${applicationId}`)
          if (appResult.rows.length === 0)
            return Response.json({ success: false, message: 'Application not found' }, { status: 400 })
          const appName = (appResult.rows[0] as any).app_name

          for (const entry of dictionaryData) {
            await db.execute(sql`
              INSERT INTO response_code_dictionary (id_app_identifier, jenis_transaksi, rc, rc_description, error_type)
              VALUES (${applicationId}, ${entry.jenis_transaksi}, ${entry.rc}, ${entry.rc_description}, ${entry.error_type})
              ON CONFLICT (id_app_identifier, jenis_transaksi, rc)
              DO UPDATE SET error_type = EXCLUDED.error_type, rc_description = COALESCE(EXCLUDED.rc_description, response_code_dictionary.rc_description)
            `)
          }

          await logAuditEvent(
            session.userId,
            session.username,
            'DICTIONARY_UPLOADED',
            'response_code_dictionary',
            applicationId.toString(),
            `Uploaded ${dictionaryData.length} entries for ${appName}`,
            getClientIp(request),
            getUserAgent(request),
          )

          return Response.json({
            success: true,
            message: `Dictionary uploaded. ${dictionaryData.length} entries processed.`,
            data: { entriesProcessed: dictionaryData.length, applicationId, applicationName: appName },
          })
        } catch (error: any) {
          if (error.message?.includes('Unauthorized'))
            return Response.json({ success: false, message: error.message }, { status: 403 })
          console.error('Error uploading dictionary:', error)
          return Response.json({ success: false, message: `Error: ${error.message}` }, { status: 500 })
        }
      },
    },
  },
})
