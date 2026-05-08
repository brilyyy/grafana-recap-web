import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import type { ApiResponse, DictionaryViewEntry } from '@/types'

// GET - Fetch all dictionary entries with rc_description
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const errorTypeParam = searchParams.get('error_type') || ''
    const appIdParam = searchParams.get('app_id') || ''
    const jenisTransaksiParam = searchParams.get('jenis_transaksi') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '25')
    const fetchAll = !searchParams.has('page') && !searchParams.has('limit')

    // Parse multiple values (comma-separated)
    const errorTypes = errorTypeParam ? errorTypeParam.split(',').filter(Boolean) : []
    const appIds = appIdParam ? appIdParam.split(',').filter(Boolean).map(id => parseInt(id)) : []
    const jenisTransaksiList = jenisTransaksiParam ? jenisTransaksiParam.split(',').filter(Boolean) : []

    const connection = await pool.getConnection()
    try {
      // Build query with filters - Get rc_description directly from dictionary table
      let query = `
        SELECT DISTINCT
          d.id,
          d.id_app_identifier,
          a.app_name,
          d.jenis_transaksi,
          d.rc,
          d.rc_description,
          d.error_type
        FROM response_code_dictionary d
        INNER JOIN app_identifier a ON d.id_app_identifier = a.id
        WHERE 1=1
      `

      const params: any[] = []

      // Filter by app (multiple)
      if (appIds.length > 0) {
        const placeholders = appIds.map(() => '?').join(',')
        query += ` AND d.id_app_identifier IN (${placeholders})`
        params.push(...appIds)
      }

      // Filter by error_type (multiple)
      if (errorTypes.length > 0) {
        const validTypes = errorTypes.filter((type) => ['S', 'N', 'Sukses'].includes(type))
        if (validTypes.length > 0) {
          const placeholders = validTypes.map(() => '?').join(',')
          query += ` AND d.error_type IN (${placeholders})`
          params.push(...validTypes)
        }
      }

      // Filter by jenis_transaksi (multiple)
      if (jenisTransaksiList.length > 0) {
        const placeholders = jenisTransaksiList.map(() => '?').join(',')
        query += ` AND d.jenis_transaksi IN (${placeholders})`
        params.push(...jenisTransaksiList)
      }

      // Search filter
      if (search) {
        query += ` AND (
          d.rc LIKE ? 
          OR d.jenis_transaksi LIKE ? 
          OR a.app_name LIKE ?
          OR (
            d.rc_description IS NOT NULL 
            AND d.rc_description LIKE ?
          )
        )`
        const searchPattern = `%${search}%`
        params.push(searchPattern, searchPattern, searchPattern, searchPattern)
      }

      // Get total count for pagination (simplified query without subquery)
      // Build count query with separate params to avoid parameter mismatch
      let countQuery = `
        SELECT COUNT(DISTINCT d.id) as total
        FROM response_code_dictionary d
        INNER JOIN app_identifier a ON d.id_app_identifier = a.id
        WHERE 1=1
      `
      
      const countParams: any[] = []
      
      // Apply same filters to count query with separate params
      if (appIds.length > 0) {
        const placeholders = appIds.map(() => '?').join(',')
        countQuery += ` AND d.id_app_identifier IN (${placeholders})`
        countParams.push(...appIds)
      }
      
      if (errorTypes.length > 0) {
        const validTypes = errorTypes.filter((type) => ['S', 'N', 'Sukses'].includes(type))
        if (validTypes.length > 0) {
          const placeholders = validTypes.map(() => '?').join(',')
          countQuery += ` AND d.error_type IN (${placeholders})`
          countParams.push(...validTypes)
        }
      }
      
      if (jenisTransaksiList.length > 0) {
        const placeholders = jenisTransaksiList.map(() => '?').join(',')
        countQuery += ` AND d.jenis_transaksi IN (${placeholders})`
        countParams.push(...jenisTransaksiList)
      }
      
      if (search) {
        countQuery += ` AND (
          d.rc LIKE ? 
          OR d.jenis_transaksi LIKE ? 
          OR a.app_name LIKE ?
          OR (
            d.rc_description IS NOT NULL 
            AND d.rc_description LIKE ?
          )
        )`
        const searchPattern = `%${search}%`
        countParams.push(searchPattern, searchPattern, searchPattern, searchPattern)
      }
      
      const [countResult]: any = await connection.execute(countQuery, countParams)
      const total = countResult[0]?.total || 0

      query += ' ORDER BY a.app_name, d.rc, d.jenis_transaksi'

      // Apply pagination if not fetching all
      if (!fetchAll && limit > 0) {
        const offset = (page - 1) * limit
        // LIMIT and OFFSET are safe to use directly as they're parsed from integers
        // Both MySQL and PostgreSQL support LIMIT/OFFSET syntax
        query += ` LIMIT ${limit} OFFSET ${offset}`
      }

      const [rows]: any = await connection.execute(query, params)

      const responseData = {
        success: true,
        data: rows,
        total: total,
        page: fetchAll ? 1 : page,
        limit: fetchAll ? total : limit,
        totalPages: fetchAll ? 1 : Math.ceil(total / limit),
      }

      return NextResponse.json(responseData as ApiResponse<DictionaryViewEntry[]> & { total: number; page: number; limit: number; totalPages: number })
    } finally {
      connection.release()
    }
  } catch (error: any) {
    console.error('Error fetching dictionary:', error.message)
    return NextResponse.json(
      {
        success: false,
        message: error.message,
      } as ApiResponse,
      { status: 500 }
    )
  }
}
