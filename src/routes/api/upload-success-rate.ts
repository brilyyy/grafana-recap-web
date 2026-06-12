import { createFileRoute } from '@tanstack/react-router'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { appIdentifier, appSuccessRate, responseCodeDictionary, unmappedRc } from '@/db/schema'
import { getClientIp, getUserAgent, logAuditEvent } from '@/lib/audit'
import { requireAuth } from '@/lib/auth'
import { buildColumnIndex, getRowValue, parseDateValue, parseFile, validateHeaders } from '@/lib/file-parser'
import type { ApiResponse, SuccessRateEntry } from '@/types'

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

          if (!file)
            return Response.json({ success: false, message: 'No file uploaded' } as ApiResponse, { status: 400 })
          if (!/\.(xlsx|csv)$/i.test(file.name))
            return Response.json(
              { success: false, message: 'Only .xlsx or .csv files are supported' } as ApiResponse,
              { status: 400 },
            )
          if (!selectedApplicationId || Number.isNaN(parseInt(selectedApplicationId, 10)))
            return Response.json(
              { success: false, message: 'Valid application selection is required' } as ApiResponse,
              { status: 400 },
            )

          const applicationId = parseInt(selectedApplicationId, 10)
          const { headers, rows } = await parseFile(file)

          if (headers.length === 0)
            return Response.json({ success: false, message: 'File is empty' } as ApiResponse, { status: 400 })

          const validation = validateHeaders(headers, requiredColumns, optionalColumns)
          if (!validation.valid)
            return Response.json({ success: false, message: validation.error } as ApiResponse, { status: 400 })

          const colIdx = buildColumnIndex(headers, [...requiredColumns, ...optionalColumns])
          const successRateData: SuccessRateEntry[] = []
          const skippedRows: Array<{ rowNumber: number; reason: string }> = []

          for (let i = 0; i < rows.length; i++) {
            const row = rows[i]
            const rowNumber = i + 2

            const tanggalStr = getRowValue(row, headers, 'Tanggal Transaksi', colIdx)
            const jenisTransaksi = getRowValue(row, headers, 'Jenis Transaksi', colIdx)
            const rcRaw = getRowValue(row, headers, 'RC', colIdx)
            const rcDescription = colIdx['RC Description'] !== undefined
              ? getRowValue(row, headers, 'RC Description', colIdx) || null
              : null
            const rawStatus = getRowValue(row, headers, 'Status Transaksi', colIdx)

            if (!tanggalStr && !jenisTransaksi) continue

            const dateValue = parseDateValue(tanggalStr)
            if (!dateValue || isNaN(dateValue.getTime())) {
              skippedRows.push({ rowNumber, reason: `Invalid date: "${tanggalStr || '(empty)'}"` })
              continue
            }
            const tanggalTransaksi = `${dateValue.getFullYear()}-${String(dateValue.getMonth() + 1).padStart(2, '0')}-${String(dateValue.getDate()).padStart(2, '0')}`
            const bulan = String(dateValue.getMonth() + 1)
            const tahun = dateValue.getFullYear()

            if (!jenisTransaksi) {
              skippedRows.push({ rowNumber, reason: 'Jenis Transaksi required' })
              continue
            }

            let rc = rcRaw || null
            if (rc === '') rc = null
            const statusTransaksi = rawStatus || null

            let errorType: 'Sukses' | null = null
            const rcValue = rc?.trim() || ''
            const isRcEmpty = !rcValue || rcValue === '-'
            if (isRcEmpty) {
              const normDesc = rcDescription?.toLowerCase()?.trim() || ''
              const normStatus = statusTransaksi?.toLowerCase()?.trim() || ''
              if (['sukses', 'success', 'berhasil'].includes(normDesc) || ['sukses', 'success', 'berhasil'].includes(normStatus)) {
                rc = '00'
                errorType = 'Sukses'
              }
            }

            const totalTransaksi = getRowValue(row, headers, 'total transaksi', colIdx)
            const totalNominal = getRowValue(row, headers, 'Total Nominal', colIdx)
            const totalBiayaAdmin = getRowValue(row, headers, 'Total Biaya Admin', colIdx)

            const totalTransaksiNum = totalTransaksi ? parseInt(totalTransaksi, 10) : null
            const totalNominalNum = totalNominal ? parseFloat(totalNominal) : null
            const totalBiayaAdminNum = totalBiayaAdmin ? parseFloat(totalBiayaAdmin) : null
            const invalidNumeric = [
              ['total transaksi', totalTransaksiNum],
              ['Total Nominal', totalNominalNum],
              ['Total Biaya Admin', totalBiayaAdminNum],
            ].find(([, value]) => typeof value === 'number' && Number.isNaN(value))
            if (invalidNumeric) {
              skippedRows.push({ rowNumber, reason: `Invalid number in "${invalidNumeric[0]}"` })
              continue
            }

            successRateData.push({
              tanggal_transaksi: tanggalTransaksi,
              bulan,
              tahun,
              jenis_transaksi: jenisTransaksi,
              rc,
              rc_description: rcDescription,
              total_transaksi: totalTransaksiNum,
              total_nominal: totalNominalNum,
              total_biaya_admin: totalBiayaAdminNum,
              status_transaksi: statusTransaksi,
              error_type: errorType,
              id_app_identifier: applicationId,
            })
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

          const [app] = await db
            .select({ appName: appIdentifier.appName })
            .from(appIdentifier)
            .where(eq(appIdentifier.id, applicationId))
          if (!app) {
            return Response.json({ success: false, message: 'Selected application does not exist' } as ApiResponse, {
              status: 400,
            })
          }
          const applicationName = app.appName

          await db.transaction(async (tx) => {
            // Rows with an RC (and not already classified as 'Sukses' by the
            // parse pass) get their error_type from the dictionary; unknown
            // RCs are queued in unmapped_rc for manual mapping.
            const needsLookup = successRateData.filter((entry) => {
              const rcValue = entry.rc?.trim() || ''
              return rcValue && rcValue !== '-' && entry.error_type !== 'Sukses'
            })

            if (needsLookup.length > 0) {
              const dictRows = await tx
                .select({
                  jenisTransaksi: responseCodeDictionary.jenisTransaksi,
                  rc: responseCodeDictionary.rc,
                  errorType: responseCodeDictionary.errorType,
                })
                .from(responseCodeDictionary)
                .where(
                  and(
                    eq(responseCodeDictionary.idAppIdentifier, applicationId),
                    inArray(responseCodeDictionary.jenisTransaksi, [
                      ...new Set(needsLookup.map((entry) => entry.jenis_transaksi)),
                    ]),
                    inArray(responseCodeDictionary.rc, [...new Set(needsLookup.map((entry) => entry.rc as string))]),
                  ),
                )
              const pairKey = (jenis: string, rc: string) => `${jenis}\u0000${rc}`
              const dictionary = new Map(
                dictRows.map((row) => [pairKey(row.jenisTransaksi ?? '', row.rc ?? ''), row.errorType]),
              )

              const unmapped = new Map<string, (typeof needsLookup)[number]>()
              for (const entry of needsLookup) {
                const key = pairKey(entry.jenis_transaksi, entry.rc as string)
                const mapped = dictionary.get(key)
                if (mapped !== undefined) entry.error_type = mapped
                else if (!unmapped.has(key)) unmapped.set(key, entry)
              }

              if (unmapped.size > 0) {
                await tx
                  .insert(unmappedRc)
                  .values(
                    [...unmapped.values()].map((entry) => ({
                      idAppIdentifier: applicationId,
                      jenisTransaksi: entry.jenis_transaksi,
                      rc: entry.rc as string,
                      rcDescription: entry.rc_description,
                      statusTransaksi: entry.status_transaksi,
                      errorType: null,
                    })),
                  )
                  .onConflictDoNothing()
              }
            }

            const CHUNK_SIZE = 500
            for (let i = 0; i < successRateData.length; i += CHUNK_SIZE) {
              const chunk = successRateData.slice(i, i + CHUNK_SIZE)
              await tx.insert(appSuccessRate).values(
                chunk.map((entry) => ({
                  idAppIdentifier: entry.id_app_identifier,
                  tanggalTransaksi: entry.tanggal_transaksi,
                  bulan: entry.bulan,
                  tahun: entry.tahun,
                  jenisTransaksi: entry.jenis_transaksi,
                  rc: entry.rc,
                  rcDescription: entry.rc_description,
                  totalTransaksi: entry.total_transaksi,
                  totalNominal: entry.total_nominal != null ? String(entry.total_nominal) : null,
                  totalBiayaAdmin: entry.total_biaya_admin != null ? String(entry.total_biaya_admin) : null,
                  statusTransaksi: entry.status_transaksi,
                  errorType: entry.error_type,
                })),
              )
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
          if (error.message?.includes('Unauthorized')) {
            return Response.json({ success: false, message: error.message } as ApiResponse, { status: 401 })
          }
          if (error.message?.includes('Forbidden')) {
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
