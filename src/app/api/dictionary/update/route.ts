import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { logAuditEvent, getClientIp, getUserAgent } from '@/lib/audit'
import type { ApiResponse } from '@/types'

// PATCH - Update dictionary entry error_type
export async function PATCH(request: NextRequest) {
  try {
    const session = await requireAuth(request)
    const body = await request.json()
    const { id, error_type } = body

    // Validate input
    if (!id || typeof id !== 'number') {
      return NextResponse.json(
        {
          success: false,
          message: 'Valid dictionary entry ID is required',
        } as ApiResponse,
        { status: 400 }
      )
    }

    if (!error_type || !['S', 'N', 'Sukses'].includes(error_type)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Valid error_type (S, N, or Sukses) is required',
        } as ApiResponse,
        { status: 400 }
      )
    }

    const connection = await pool.getConnection()
    try {
      // First, verify the dictionary entry exists
      const [entryResult]: any = await connection.execute(
        'SELECT id_app_identifier, jenis_transaksi, rc FROM response_code_dictionary WHERE id = ?',
        [id]
      )

      if (entryResult.length === 0) {
        return NextResponse.json(
          {
            success: false,
            message: 'Dictionary entry not found',
          } as ApiResponse,
          { status: 404 }
        )
      }

      const entry = entryResult[0]
      
      // Get old error_type for audit log
      const [oldEntry]: any = await connection.execute(
        'SELECT error_type FROM response_code_dictionary WHERE id = ?',
        [id]
      )
      const oldErrorType = oldEntry[0]?.error_type || null

      // Update the dictionary entry
      await connection.execute(
        'UPDATE response_code_dictionary SET error_type = ? WHERE id = ?',
        [error_type, id]
      )

      // Also update all app_success_rate entries that match this dictionary entry
      // and have NULL error_type
      const [updateResult]: any = await connection.execute(
        `UPDATE app_success_rate 
         SET error_type = ? 
         WHERE id_app_identifier = ? 
           AND jenis_transaksi = ? 
           AND rc = ? 
           AND error_type IS NULL`,
        [error_type, entry.id_app_identifier, entry.jenis_transaksi, entry.rc]
      )
      
      const updatedRows = updateResult.affectedRows || 0

      // Log audit event
      await logAuditEvent(
        session.userId,
        session.username,
        'DICTIONARY_UPDATED',
        'response_code_dictionary',
        id.toString(),
        `Updated dictionary entry (id: ${id}, app: ${entry.id_app_identifier}, jenis_transaksi: ${entry.jenis_transaksi}, rc: ${entry.rc}). error_type changed from "${oldErrorType}" to "${error_type}". ${updatedRows} app_success_rate entries updated.`,
        getClientIp(request),
        getUserAgent(request)
      )

      return NextResponse.json({
        success: true,
        message: 'Dictionary entry updated successfully',
        data: {
          id,
          error_type,
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
    
    console.error('Error updating dictionary:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error updating dictionary entry: ' + error.message,
      } as ApiResponse,
      { status: 500 }
    )
  }
}

