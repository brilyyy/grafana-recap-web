import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { logAuditEvent, getClientIp, getUserAgent } from '@/lib/audit'
import { env } from '@/env'
import type { ApiResponse } from '@/types'

const isPostgres = env.DB_TYPE === 'postgresql' || env.DB_TYPE === 'postgres'

const rcDictUpsertSql = isPostgres
  ? `INSERT INTO "response_code_dictionary" ("id_app_identifier","jenis_transaksi","rc","error_type") VALUES (?,?,?,?) ON CONFLICT ("id_app_identifier","jenis_transaksi","rc") DO UPDATE SET "error_type"=EXCLUDED."error_type"`
  : 'INSERT INTO `response_code_dictionary` (`id_app_identifier`,`jenis_transaksi`,`rc`,`error_type`) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE `error_type`=VALUES(`error_type`)'

// POST - Submit mapping for an unmapped RC
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request)
    const body = await request.json()
    const { id, id_app_identifier, jenis_transaksi, rc, error_type } = body

    // Validate required fields
    if (!id || !id_app_identifier || !rc || !error_type) {
      return NextResponse.json(
        {
          success: false,
          message: 'Missing required fields: id, id_app_identifier, rc, error_type',
        } as ApiResponse,
        { status: 400 }
      )
    }

    // Validate error_type value
    if (!['S', 'N', 'Sukses'].includes(error_type)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid error_type. Must be S, N, or Sukses',
        } as ApiResponse,
        { status: 400 }
      )
    }

    const connection = await pool.getConnection()
    try {
      // Start transaction
      await connection.beginTransaction()

      // 1. Insert into response_code_dictionary with upsert
      await connection.execute(rcDictUpsertSql, [id_app_identifier, jenis_transaksi || '', rc, error_type])

      // 2. Update every app_success_rate row for the same composite key as dictionary/unmapped row
      // (aligned with PATCH /api/dictionary/update — no status_transaksi filter)
      const jt = jenis_transaksi
      let updateQuery: string
      let updateParams: any[]

      if (jt != null && String(jt).trim() !== '') {
        updateQuery = `UPDATE app_success_rate 
         SET error_type = ?
         WHERE id_app_identifier = ? 
           AND jenis_transaksi = ?
           AND rc = ?`
        updateParams = [error_type, id_app_identifier, jt, rc]
      } else {
        updateQuery = `UPDATE app_success_rate 
         SET error_type = ?
         WHERE id_app_identifier = ? 
           AND rc = ?
           AND (jenis_transaksi IS NULL OR jenis_transaksi = '')`
        updateParams = [error_type, id_app_identifier, rc]
      }

      const [first, second]: any = await connection.execute(updateQuery, updateParams)
      const updatedRows = first?.affectedRows ?? second?.rowCount ?? 0

      // 3. Delete from unmapped_rc
      await connection.execute(
        `DELETE FROM unmapped_rc WHERE id = ?`,
        [id]
      )

      // Commit transaction
      await connection.commit()

      // Log audit event
      await logAuditEvent(
        session.userId,
        session.username,
        'UNMAPPED_RC_SUBMITTED',
        'unmapped_rc',
        id.toString(),
        `Submitted unmapped RC mapping (id: ${id}, app: ${id_app_identifier}, jenis_transaksi: ${jenis_transaksi || 'N/A'}, rc: ${rc}). error_type: ${error_type}. ${updatedRows} app_success_rate entries updated.`,
        getClientIp(request),
        getUserAgent(request)
      )

      return NextResponse.json({
        success: true,
        message: `RC mapping added successfully. RC ${rc} mapped to ${error_type}`,
      } as ApiResponse)
    } catch (error) {
      // Rollback on error
      await connection.rollback()
      throw error
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
    
    console.error('Error submitting RC mapping:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error submitting RC mapping: ' + error.message,
      } as ApiResponse,
      { status: 500 }
    )
  }
}
