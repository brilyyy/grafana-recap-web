import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import type { ApiResponse } from '@/types'

export async function POST() {
  try {
    const connection = await pool.getConnection()

    try {
      // Update app_success_rate table: status_transaksi ENUM → VARCHAR(255)
      await connection.execute(`
        ALTER TABLE app_success_rate 
        MODIFY COLUMN status_transaksi VARCHAR(255) NULL
      `)

      // Update app_success_rate table: rc dan error_type boleh NULL
      await connection.execute(`
        ALTER TABLE app_success_rate 
        MODIFY COLUMN rc VARCHAR(50) NULL,
        MODIFY COLUMN error_type ENUM('S', 'N', 'Sukses') NULL
      `)

      // Update app_success_rate table: tanggal_transaksi, bulan, tahun, jenis_transaksi WAJIB
      await connection.execute(`
        ALTER TABLE app_success_rate 
        MODIFY COLUMN tanggal_transaksi DATE NOT NULL,
        MODIFY COLUMN bulan VARCHAR(20) NOT NULL,
        MODIFY COLUMN tahun INT NOT NULL,
        MODIFY COLUMN jenis_transaksi VARCHAR(255) NOT NULL
      `)

      // Update unmapped_rc table: status_transaksi ENUM → VARCHAR(255)
      await connection.execute(`
        ALTER TABLE unmapped_rc 
        MODIFY COLUMN status_transaksi VARCHAR(255) NULL
      `)

      console.log('✅ Database schema migrated successfully!')
      
      return NextResponse.json({
        success: true,
        message: 'Database schema migrated successfully. status_transaksi changed to VARCHAR(255), rc and error_type can be NULL, and required fields updated.',
      } as ApiResponse)
    } catch (error: any) {
      console.error('Error migrating database schema:', error.message)
      
      // If column doesn't exist or already has the correct ENUM, that's okay
      if (error.code === 'ER_BAD_FIELD_ERROR' || error.message.includes('Duplicate enum')) {
        return NextResponse.json({
          success: true,
          message: 'Schema is already up to date or migration is not needed.',
        } as ApiResponse)
      }
      
      return NextResponse.json(
        {
          success: false,
          message: error.message,
        } as ApiResponse,
        { status: 500 }
      )
    } finally {
      connection.release()
    }
  } catch (error: any) {
    console.error('Error migrating database schema:', error.message)
    return NextResponse.json(
      {
        success: false,
        message: error.message,
      } as ApiResponse,
      { status: 500 }
    )
  }
}

