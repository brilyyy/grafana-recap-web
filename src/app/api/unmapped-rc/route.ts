import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import type { ApiResponse, UnmappedRC } from '@/types'

// GET - List all unmapped RCs
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const appId = searchParams.get('appId')

    const connection = await pool.getConnection()
    try {
      let query = `
        SELECT 
          u.id,
          u.id_app_identifier,
          a.app_name,
          u.jenis_transaksi,
          u.rc,
          u.rc_description,
          u.status_transaksi,
          u.error_type,
          u.created_at
        FROM unmapped_rc u
        LEFT JOIN app_identifier a ON u.id_app_identifier = a.id
      `
      const queryParams: any[] = []

      if (appId) {
        query += ' WHERE u.id_app_identifier = ?'
        queryParams.push(parseInt(appId))
      }

      query += ' ORDER BY u.created_at DESC'

      const [rows]: any = await connection.execute(query, queryParams)

      return NextResponse.json({
        success: true,
        data: rows as UnmappedRC[],
      } as ApiResponse<UnmappedRC[]>)
    } finally {
      connection.release()
    }
  } catch (error: any) {
    console.error('Error fetching unmapped RCs:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error fetching unmapped RCs: ' + error.message,
      } as ApiResponse,
      { status: 500 }
    )
  }
}

