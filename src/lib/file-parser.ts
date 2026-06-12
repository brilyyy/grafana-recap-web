import ExcelJS from 'exceljs'
import { parseCsvRows } from '@/lib/csv'

export type RowData = Record<string, string>

function cellToString(cell: ExcelJS.Cell | undefined): string {
  if (!cell) return ''
  const val = cell.value
  if (val == null) return ''
  if (val instanceof Date) return val.toISOString()
  if (typeof val === 'object' && 'richText' in val) {
    return (val as any).richText?.map((r: any) => r.text).join('') ?? ''
  }
  if (typeof val === 'object' && 'text' in val) {
    return (val as any).text ?? ''
  }
  return String(val).trim()
}

export interface ParsedFile {
  headers: string[]
  rows: RowData[]
}

export async function parseFile(file: File): Promise<ParsedFile> {
  const isCSV = file.name.toLowerCase().endsWith('.csv')

  if (isCSV) {
    const text = await file.text()
    const rawRows = parseCsvRows(text)
    if (rawRows.length === 0) return { headers: [], rows: [] }
    const headers = rawRows[0].map((h) => h.trim())
    const rows: RowData[] = []
    for (let i = 1; i < rawRows.length; i++) {
      const row: RowData = {}
      for (let c = 0; c < headers.length; c++) {
        row[headers[c]] = (rawRows[i][c] ?? '').trim()
      }
      rows.push(row)
    }
    return { headers, rows }
  }

  const bytes = await file.arrayBuffer()
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(bytes)
  const worksheet = workbook.worksheets[0]
  if (!worksheet) return { headers: [], rows: [] }

  const headerRow = worksheet.getRow(1)
  let headers: string[] = []
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber - 1] = cellToString(cell)
  })
  // eachCell can still leave holes for never-written cells; blank them so
  // header validation reports a missing column instead of crashing
  headers = Array.from(headers, (h) => h ?? '')

  const rows: RowData[] = []
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const rowData: RowData = {}
    let hasValue = false
    for (let c = 0; c < headers.length; c++) {
      const val = cellToString(row.getCell(c + 1))
      rowData[headers[c]] = val
      if (val) hasValue = true
    }
    if (hasValue) rows.push(rowData)
  })

  return { headers, rows }
}

function buildValidDate(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month - 1, day)
  // Reject rollover dates like 31/02/2025 → Mar 3
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return date
}

export function parseDateValue(value: unknown): Date | null {
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value
  if (typeof value === 'number') {
    const excelEpoch = new Date(1899, 11, 30)
    const d = new Date(excelEpoch.getTime() + value * 86400000)
    return isNaN(d.getTime()) ? null : d
  }
  if (typeof value === 'string') {
    const str = value.trim()
    if (!str) return null
    const slash = str.split('/')
    if (slash.length === 3) {
      const d = parseInt(slash[0], 10), m = parseInt(slash[1], 10), y = parseInt(slash[2], 10)
      if (!isNaN(d) && !isNaN(m) && !isNaN(y)) return buildValidDate(y, m, d)
    }
    const dash = str.split('-')
    if (dash.length === 3) {
      const y = parseInt(dash[0], 10), m = parseInt(dash[1], 10), d = parseInt(dash[2], 10)
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) return buildValidDate(y, m, d)
    }
    const d = new Date(str)
    return isNaN(d.getTime()) ? null : d
  }
  return null
}

export function validateHeaders(
  headers: string[],
  required: string[],
  optional: string[],
): { valid: boolean; error?: string } {
  if (headers.length < required.length || headers.length > required.length + optional.length) {
    return { valid: false, error: `Expected ${required.length}-${required.length + optional.length} columns, got ${headers.length}` }
  }
  const normalized = headers.map((h) => h.toLowerCase())
  const missing = required.filter((r) => !normalized.includes(r.toLowerCase()))
  if (missing.length > 0) {
    return { valid: false, error: `Missing required columns: ${missing.join(', ')}` }
  }
  return { valid: true }
}

export function buildColumnIndex(headers: string[], columns: string[]): Record<string, number> {
  const normalized = headers.map((h) => h.toLowerCase())
  const idx: Record<string, number> = {}
  for (const col of columns) {
    const i = normalized.indexOf(col.toLowerCase())
    if (i >= 0) idx[col] = i
  }
  return idx
}

export function getRowValue(row: RowData, headers: string[], colName: string, colIdx: Record<string, number>): string {
  const idx = colIdx[colName]
  if (idx === undefined) return ''
  return row[headers[idx]] ?? ''
}
