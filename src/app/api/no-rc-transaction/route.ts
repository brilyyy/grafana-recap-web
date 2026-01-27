import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import type { ApiResponse, SuccessRateEntry } from '@/types'

// GET - List semua transaksi tanpa RC dari app_success_rate WHERE rc IS NULL
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const appId = searchParams.get('appId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '25')
    const offset = (page - 1) * limit

    const connection = await pool.getConnection()
    try {
      let query = `
        SELECT 
          a.id,
          a.id_app_identifier,
          app.app_name,
          a.tanggal_transaksi,
          a.bulan,
          a.tahun,
          a.jenis_transaksi,
          a.rc,
          a.rc_description,
          a.total_transaksi,
          a.total_nominal,
          a.total_biaya_admin,
          a.status_transaksi,
          a.error_type,
          a.created_at,
          a.updated_at
        FROM app_success_rate a
        LEFT JOIN app_identifier app ON a.id_app_identifier = app.id
        WHERE a.rc IS NULL
          AND a.error_type IS NULL
      `
      const queryParams: any[] = []
      const countParams: any[] = []

      if (appId) {
        query += ' AND a.id_app_identifier = ?'
        queryParams.push(parseInt(appId))
        countParams.push(parseInt(appId))
      }

      // Get total count (separate query with proper parameters)
      let countQuery = `
        SELECT COUNT(*) as total
        FROM app_success_rate a
        LEFT JOIN app_identifier app ON a.id_app_identifier = app.id
        WHERE a.rc IS NULL
          AND a.error_type IS NULL
      `
      if (appId) {
        countQuery += ' AND a.id_app_identifier = ?'
      }
      
      const [countResult]: any = await connection.execute(countQuery, countParams)
      const total = countResult[0].total

      // Get paginated data
      query += ` ORDER BY a.created_at DESC LIMIT ${limit} OFFSET ${offset}`

      const [rows]: any = await connection.execute(query, queryParams)

      return NextResponse.json({
        success: true,
        data: rows as SuccessRateEntry[],
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      } as ApiResponse<SuccessRateEntry[]>)
    } finally {
      connection.release()
    }
  } catch (error: any) {
    console.error('Error fetching no RC transactions:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error fetching no RC transactions: ' + error.message,
      } as ApiResponse,
      { status: 500 }
    )
  }
}

