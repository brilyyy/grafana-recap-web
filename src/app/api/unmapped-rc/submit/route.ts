import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { adapter } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { logAuditEvent, getClientIp, getUserAgent } from '@/lib/audit'
import { buildSimpleUpsertQuery } from '@/lib/sql-helpers'
import type { ApiResponse } from '@/types'

// POST - Submit mapping for an unmapped RC
export async function POST(request: NextRequest) {
  try {
    const session = requireAuth(request)
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
      const upsertQuery = buildSimpleUpsertQuery(
        adapter,
        'response_code_dictionary',
        ['id_app_identifier', 'jenis_transaksi', 'rc', 'error_type'],
        ['id_app_identifier', 'jenis_transaksi', 'rc'], // conflict columns (unique key)
        ['error_type'] // update columns
      )
      await connection.execute(
        upsertQuery,
        [id_app_identifier, jenis_transaksi || '', rc, error_type]
      )

      // 2. Update all app_success_rate entries that match this RC
      // This includes:
      // - Entries with error_type IS NULL (failed status)
      // - Entries with status_transaksi = 'pending' AND error_type = 'S' (pending status that was defaulted to 'S')
      // - Entries with status_transaksi = 'suspect' AND error_type = 'S' (suspect status that was defaulted to 'S')
      // - Entries with status_transaksi = 'cancelled' AND error_type = 'S' (cancelled status that was defaulted to 'S')
      // Build query based on whether jenis_transaksi is provided
      let updateQuery: string
      let updateParams: any[]
      
      if (jenis_transaksi && jenis_transaksi !== '') {
        // If jenis_transaksi is provided, match it specifically
        updateQuery = `UPDATE app_success_rate 
         SET error_type = ?
         WHERE id_app_identifier = ? 
         AND rc = ? 
         AND jenis_transaksi = ?
         AND (error_type IS NULL OR (status_transaksi = 'pending' AND error_type = 'S') OR (status_transaksi = 'suspect' AND error_type = 'S') OR (status_transaksi = 'cancelled' AND error_type = 'S'))`
        updateParams = [error_type, id_app_identifier, rc, jenis_transaksi]
      } else {
        // If jenis_transaksi is not provided, update all RCs regardless of jenis_transaksi
        updateQuery = `UPDATE app_success_rate 
         SET error_type = ?
         WHERE id_app_identifier = ? 
         AND rc = ?
         AND (error_type IS NULL OR (status_transaksi = 'pending' AND error_type = 'S') OR (status_transaksi = 'suspect' AND error_type = 'S') OR (status_transaksi = 'cancelled' AND error_type = 'S'))`
        updateParams = [error_type, id_app_identifier, rc]
      }
      
      const [updateResult]: any = await connection.execute(updateQuery, updateParams)
      const updatedRows = updateResult.affectedRows || 0

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
