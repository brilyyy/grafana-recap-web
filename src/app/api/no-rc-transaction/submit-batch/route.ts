import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { env } from '@/env'
import type { ApiResponse } from '@/types'

const isPostgres = env.DB_TYPE === 'postgresql' || env.DB_TYPE === 'postgres'

const unmappedRcUpsertSql = isPostgres
  ? `INSERT INTO "unmapped_rc" ("id_app_identifier","jenis_transaksi","rc","rc_description","status_transaksi","error_type") VALUES (?,?,?,?,?,?) ON CONFLICT ("id_app_identifier","jenis_transaksi","rc") DO UPDATE SET "rc_description"=EXCLUDED."rc_description","status_transaksi"=EXCLUDED."status_transaksi"`
  : 'INSERT INTO `unmapped_rc` (`id_app_identifier`,`jenis_transaksi`,`rc`,`rc_description`,`status_transaksi`,`error_type`) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE `rc_description`=VALUES(`rc_description`),`status_transaksi`=VALUES(`status_transaksi`)'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { mappings } = body

    if (!mappings || !Array.isArray(mappings) || mappings.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Mappings array is required',
        } as ApiResponse,
        { status: 400 }
      )
    }

    // Validate all mappings
    for (const mapping of mappings) {
      if (!mapping.id || !mapping.rc || mapping.rc.trim() === '') {
        return NextResponse.json(
          {
            success: false,
            message: 'All mappings must have id and rc',
          } as ApiResponse,
          { status: 400 }
        )
      }
    }

    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()

      for (const mapping of mappings) {
        const { id, rc, rc_description } = mapping

        // 1. Update app_success_rate.rc dan rc_description
        await connection.execute(
          `UPDATE app_success_rate 
           SET rc = ?, rc_description = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [rc.trim(), rc_description?.trim() || null, id]
        )

        // 2. Get id_app_identifier and jenis_transaksi from the record
        const [recordResult]: any = await connection.execute(
          'SELECT id_app_identifier, jenis_transaksi FROM app_success_rate WHERE id = ?',
          [id]
        )

        if (recordResult.length === 0) {
          await connection.rollback()
          return NextResponse.json(
            {
              success: false,
              message: `Record with id ${id} not found`,
            } as ApiResponse,
            { status: 404 }
          )
        }

        const { id_app_identifier, jenis_transaksi } = recordResult[0]

        // 3. Cek apakah RC ada di dictionary
        const [dictionaryResult]: any = await connection.execute(
          `SELECT error_type FROM response_code_dictionary 
           WHERE id_app_identifier = ? AND jenis_transaksi = ? AND rc = ?`,
          [id_app_identifier, jenis_transaksi || '', rc.trim()]
        )

        if (dictionaryResult.length > 0) {
          // RC ada di dictionary → Update error_type dari dictionary
          const error_type = dictionaryResult[0].error_type
          await connection.execute(
            `UPDATE app_success_rate 
             SET error_type = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [error_type, id]
          )
        } else {
          // RC tidak ada di dictionary → Insert ke unmapped_rc (jika belum ada)
          // Get status_transaksi first
          const [statusResult]: any = await connection.execute(
            'SELECT status_transaksi FROM app_success_rate WHERE id = ?',
            [id]
          )
          const status_transaksi = statusResult.length > 0 ? statusResult[0].status_transaksi : null

          await connection.execute(
            unmappedRcUpsertSql,
            [id_app_identifier, jenis_transaksi || '', rc.trim(), rc_description?.trim() || null, status_transaksi, null]
          )
          // error_type tetap NULL di app_success_rate
        }
      }

      await connection.commit()

      return NextResponse.json({
        success: true,
        message: `${mappings.length} RC(s) have been assigned successfully`,
      } as ApiResponse)
    } catch (error: any) {
      await connection.rollback()
      console.error('Error updating no RC transactions:', error)
      return NextResponse.json(
        {
          success: false,
          message: 'Error updating no RC transactions: ' + error.message,
        } as ApiResponse,
        { status: 500 }
      )
    } finally {
      connection.release()
    }
  } catch (error: any) {
    console.error('Error processing request:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error processing request: ' + error.message,
      } as ApiResponse,
      { status: 500 }
    )
  }
}

