import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { env } from '@/env'
import type { ApiResponse } from '@/types'

const isPostgres = env.DB_TYPE === 'postgresql' || env.DB_TYPE === 'postgres'

const rcDictUpsertSql = isPostgres
  ? `INSERT INTO "response_code_dictionary" ("id_app_identifier","jenis_transaksi","rc","error_type") VALUES (?,?,?,?) ON CONFLICT ("id_app_identifier","jenis_transaksi","rc") DO UPDATE SET "error_type"=EXCLUDED."error_type"`
  : 'INSERT INTO `response_code_dictionary` (`id_app_identifier`,`jenis_transaksi`,`rc`,`error_type`) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE `error_type`=VALUES(`error_type`)'

// POST - Submit multiple mappings for unmapped RCs
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { mappings } = body

    // Validate required fields
    if (!Array.isArray(mappings) || mappings.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Mappings array is required and must not be empty',
        } as ApiResponse,
        { status: 400 }
      )
    }

    // Validate each mapping
    for (const mapping of mappings) {
      if (!mapping.id || !mapping.id_app_identifier || !mapping.rc || !mapping.error_type) {
        return NextResponse.json(
          {
            success: false,
            message: 'Each mapping must have: id, id_app_identifier, rc, error_type',
          } as ApiResponse,
          { status: 400 }
        )
      }

      if (!['S', 'N', 'Sukses'].includes(mapping.error_type)) {
        return NextResponse.json(
          {
            success: false,
            message: `Invalid error_type for RC ${mapping.rc}. Must be S, N, or Sukses`,
          } as ApiResponse,
          { status: 400 }
        )
      }
    }

    const connection = await pool.getConnection()
    try {
      // Start transaction
      await connection.beginTransaction()

      const results = {
        success: 0,
        failed: 0,
        errors: [] as string[],
      }

      // Process each mapping
      for (const mapping of mappings) {
        try {
          const { id, id_app_identifier, jenis_transaksi, rc, error_type } = mapping

          // 1. Insert into response_code_dictionary with upsert
          await connection.execute(rcDictUpsertSql, [id_app_identifier, jenis_transaksi || '', rc, error_type])

          // 2. Update every app_success_rate row for the same composite key (aligned with dictionary PATCH)
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

          await connection.execute(updateQuery, updateParams)

          // 3. Delete from unmapped_rc
          await connection.execute(
            `DELETE FROM unmapped_rc WHERE id = ?`,
            [id]
          )

          results.success++
        } catch (error: any) {
          results.failed++
          results.errors.push(`RC ${mapping.rc}: ${error.message}`)
        }
      }

      // Commit transaction
      await connection.commit()

      return NextResponse.json({
        success: true,
        message: `Successfully mapped ${results.success} RC(s). ${results.failed > 0 ? `Failed: ${results.failed}` : ''}`,
        data: {
          success: results.success,
          failed: results.failed,
          errors: results.errors,
        },
      } as ApiResponse & { data: { success: number; failed: number; errors: string[] } })
    } catch (error) {
      // Rollback on error
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  } catch (error: any) {
    console.error('Error submitting batch RC mappings:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error submitting batch RC mappings: ' + error.message,
      } as ApiResponse,
      { status: 500 }
    )
  }
}

