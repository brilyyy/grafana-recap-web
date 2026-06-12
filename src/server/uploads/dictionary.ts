import { eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { appIdentifier, responseCodeDictionary } from '@/db/schema'
import { logAuditEvent } from '@/lib/audit'
import { buildColumnIndex, parseFile, validateHeaders } from '@/lib/file-parser'
import type { ApiResponse } from '@/types'
import type { UploadParams } from './success-rate'

const required = ['Jenis Transaksi', 'RC', 'S/N']
const optional = ['RC Description']

export async function processDictionaryUpload({
  file,
  selectedApplicationId,
  session,
  ip,
  userAgent,
}: UploadParams): Promise<ApiResponse> {
  if (!/\.(xlsx|csv)$/i.test(file.name)) {
    return { success: false, message: 'Only .xlsx or .csv files are supported' }
  }
  if (!selectedApplicationId || Number.isNaN(parseInt(selectedApplicationId, 10))) {
    return { success: false, message: 'Valid application selection is required' }
  }

  const applicationId = parseInt(selectedApplicationId, 10)
  const { headers, rows } = await parseFile(file)

  if (headers.length === 0) return { success: false, message: 'File is empty' }

  const validation = validateHeaders(headers, required, optional)
  if (!validation.valid) return { success: false, message: validation.error }

  const colIdx = buildColumnIndex(headers, [...required, ...optional])
  const dictionaryData: Array<{
    jenis_transaksi: string
    rc: string
    rc_description: string | null
    error_type: 'S' | 'N' | 'Sukses'
  }> = []
  const skippedRows: Array<{ rowNumber: number; reason: string }> = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const jt = row[headers[colIdx['Jenis Transaksi']]] ?? ''
    const rc = row[headers[colIdx['RC']]] ?? ''
    const sn = (row[headers[colIdx['S/N']]] ?? '').toUpperCase()
    const desc = colIdx['RC Description'] !== undefined ? (row[headers[colIdx['RC Description']]] ?? '') : null

    if (!jt && !rc) continue

    let et: 'S' | 'N' | 'Sukses' | null = null
    if (sn === 'S') et = 'S'
    else if (sn === 'N') et = 'N'
    else if (sn === 'SUKSES' || sn === 'SUCCESS' || sn === 'BERHASIL') et = 'Sukses'

    if (!et) {
      skippedRows.push({ rowNumber: i + 2, reason: `Invalid S/N: "${sn}"` })
      continue
    }
    dictionaryData.push({ jenis_transaksi: jt, rc, rc_description: desc || null, error_type: et })
  }

  if (skippedRows.length > 0) {
    return { success: false, message: `${skippedRows.length} row(s) have errors`, data: { skippedRows } }
  }
  if (dictionaryData.length === 0) return { success: false, message: 'No valid data' }

  const [app] = await db
    .select({ appName: appIdentifier.appName })
    .from(appIdentifier)
    .where(eq(appIdentifier.id, applicationId))
  if (!app) return { success: false, message: 'Application not found' }
  const appName = app.appName

  // Dedupe on the conflict key (last row wins) — a multi-row upsert
  // cannot touch the same (jenis, rc) twice in one statement
  const deduped = new Map<string, (typeof dictionaryData)[number]>()
  for (const entry of dictionaryData) deduped.set(`${entry.jenis_transaksi}|${entry.rc}`, entry)
  const upsertRows = [...deduped.values()]

  await db.transaction(async (tx) => {
    const CHUNK_SIZE = 500
    for (let i = 0; i < upsertRows.length; i += CHUNK_SIZE) {
      await tx
        .insert(responseCodeDictionary)
        .values(
          upsertRows.slice(i, i + CHUNK_SIZE).map((entry) => ({
            idAppIdentifier: applicationId,
            jenisTransaksi: entry.jenis_transaksi,
            rc: entry.rc,
            rcDescription: entry.rc_description,
            errorType: entry.error_type,
          })),
        )
        .onConflictDoUpdate({
          target: [
            responseCodeDictionary.idAppIdentifier,
            responseCodeDictionary.jenisTransaksi,
            responseCodeDictionary.rc,
          ],
          set: {
            errorType: sql`excluded.error_type`,
            rcDescription: sql`COALESCE(excluded.rc_description, ${responseCodeDictionary.rcDescription})`,
          },
        })
    }
  })

  await logAuditEvent(
    session.userId,
    session.username,
    'DICTIONARY_UPLOADED',
    'response_code_dictionary',
    applicationId.toString(),
    `Uploaded ${dictionaryData.length} entries for ${appName}`,
    ip,
    userAgent,
  )

  return {
    success: true,
    message: `Dictionary uploaded. ${dictionaryData.length} entries processed.`,
    data: { entriesProcessed: dictionaryData.length, applicationId, applicationName: appName },
  }
}
