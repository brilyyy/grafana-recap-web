import { parseCsvRows } from '@/lib/csv'

export interface CsvColumnValidation {
  isValid: boolean
  error?: string
}

/**
 * Client-side header validation for CSV uploads. Excel files are validated
 * on the server, so anything that is not .csv passes through.
 */
export async function validateCsvColumns(
  file: File,
  requiredColumns: string[],
  optionalColumns: string[] = [],
): Promise<CsvColumnValidation> {
  if (!file.name.toLowerCase().endsWith('.csv')) return { isValid: true }

  const text = await file.text().catch(() => null)
  if (text === null) return { isValid: false, error: 'Failed to read file' }

  try {
    const rows = parseCsvRows(text)
    if (rows.length === 0) return { isValid: false, error: 'CSV file is empty' }

    const headers = rows[0].map((h) => h.trim())
    const min = requiredColumns.length
    const max = requiredColumns.length + optionalColumns.length
    if (headers.length < min || headers.length > max) {
      return { isValid: false, error: `Expected ${min}-${max} columns, got ${headers.length}` }
    }

    const normalizedHeaders = headers.map((h) => h.toLowerCase())
    const missing = requiredColumns.filter((r) => !normalizedHeaders.includes(r.toLowerCase()))
    if (missing.length > 0) {
      return { isValid: false, error: `Missing required columns: ${missing.join(', ')}` }
    }
    return { isValid: true }
  } catch {
    return { isValid: false, error: 'Failed to parse file' }
  }
}
