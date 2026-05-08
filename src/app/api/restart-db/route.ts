import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import type { ApiResponse } from '@/types'

export async function POST() {
  try {
    const connection = await pool.getConnection()

    try {
      // Disable foreign key checks
      await connection.query('SET FOREIGN_KEY_CHECKS = 0')

      // Get all tables in the current database
      const [tables]: any = await connection.query('SHOW TABLES')

      // Drop each table
      for (const row of tables) {
        const tableName = Object.values(row)[0]
        await connection.query(`DROP TABLE IF EXISTS \`${tableName}\``)
      }

      // Re-enable foreign key checks
      await connection.query('SET FOREIGN_KEY_CHECKS = 1')

      // Create app_identifier table
      await connection.execute(`
        CREATE TABLE app_identifier (
          id INT AUTO_INCREMENT PRIMARY KEY,
          app_name VARCHAR(255) NOT NULL UNIQUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `)

      // Insert default apps
      await connection.execute(`
        INSERT INTO app_identifier(app_name)
        VALUES
          ('Bale'),
          ('CMS'),
          ('SMS Notif'),
          ('QRIS'),
          ('EDC Merchant'),
          ('EDC Agen'),
          ('Bale Korpora')
      `)

      // Create app_success_rate table
      await connection.execute(`
        CREATE TABLE app_success_rate (
          id INT AUTO_INCREMENT PRIMARY KEY,
          id_app_identifier INT NOT NULL,
          tanggal_transaksi DATE NOT NULL,
          bulan VARCHAR(20) NOT NULL,
          tahun INT NOT NULL,
          jenis_transaksi VARCHAR(255) NOT NULL,
          rc VARCHAR(255) NULL,
          rc_description VARCHAR(500) NULL,
          total_transaksi INT NULL,
          total_nominal DECIMAL(20, 2) NULL,
          total_biaya_admin DECIMAL(20, 2) NULL,
          status_transaksi VARCHAR(255) NULL,
          error_type ENUM('S', 'N', 'Sukses') NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (id_app_identifier) REFERENCES app_identifier(id) ON DELETE CASCADE
        )
      `)

      // Create response_code_dictionary table
      await connection.execute(`
        CREATE TABLE response_code_dictionary (
          id INT AUTO_INCREMENT PRIMARY KEY,
          id_app_identifier INT NOT NULL,
          jenis_transaksi VARCHAR(255),
          rc VARCHAR(255),
          rc_description VARCHAR(500),
          error_type ENUM('S', 'N', 'Sukses') NOT NULL,
          FOREIGN KEY (id_app_identifier) REFERENCES app_identifier(id) ON DELETE CASCADE,
          UNIQUE KEY unique_dictionary_entry (id_app_identifier, jenis_transaksi, rc)
        )
      `)

      // Create unmapped_rc table for RCs that don't have mapping yet
      await connection.execute(`
        CREATE TABLE unmapped_rc (
          id INT AUTO_INCREMENT PRIMARY KEY,
          id_app_identifier INT NOT NULL,
          jenis_transaksi VARCHAR(255),
          rc VARCHAR(255),
          rc_description VARCHAR(500),
          status_transaksi VARCHAR(255) NULL,
          error_type ENUM('S', 'N', 'Sukses'),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (id_app_identifier) REFERENCES app_identifier(id) ON DELETE CASCADE,
          UNIQUE KEY unique_unmapped_entry (id_app_identifier, jenis_transaksi, rc)
        )
      `)

      console.log('✅ Database schema restarted successfully!')
      
      return NextResponse.json({
        success: true,
        message: 'Database schema restarted successfully. Tables created: app_identifier, app_success_rate, response_code_dictionary, unmapped_rc',
      } as ApiResponse)
    } finally {
      connection.release()
    }
  } catch (error: any) {
    console.error('Error restarting database:', error.message)
    return NextResponse.json(
      {
        success: false,
        message: error.message,
      } as ApiResponse,
      { status: 500 }
    )
  }
}

