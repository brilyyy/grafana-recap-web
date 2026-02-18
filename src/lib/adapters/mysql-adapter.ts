import mysql from 'mysql2/promise'
import type { DatabaseAdapter, DatabaseConnection, DatabaseError } from '../db-adapter.ts'

/**
 * MySQL Database Adapter
 * Implements DatabaseAdapter interface for MySQL
 */
export class MySQLAdapter implements DatabaseAdapter {
  private pool: mysql.Pool

  constructor() {
    this.pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      // Timeout settings for large file uploads
      connectTimeout: 600000, // 10 minutes - allow enough time for connection establishment
    })
  }

  async execute(query: string, params?: any[]): Promise<[any[], any]> {
    const result = await this.pool.execute(query, params)
    return result as [any[], any]
  }

  async query(query: string, params?: any[]): Promise<[any[], any]> {
    const result = await this.pool.query(query, params)
    return result as [any[], any]
  }

  async getConnection(): Promise<DatabaseConnection> {
    const connection = await this.pool.getConnection()
    // Set very long timeout for large file uploads (30 minutes)
    await connection.query('SET SESSION wait_timeout = 1800') // 30 minutes in seconds
    await connection.query('SET SESSION interactive_timeout = 1800') // 30 minutes in seconds
    
    return {
      release: () => connection.release(),
      execute: async (query: string, params?: any[]) => {
        const result = await connection.execute(query, params)
        return result as [any[], any]
      },
      query: async (query: string, params?: any[]) => {
        const result = await connection.query(query, params)
        return result as [any[], any]
      },
      beginTransaction: async () => {
        await connection.beginTransaction()
      },
      commit: async () => {
        await connection.commit()
      },
      rollback: async () => {
        await connection.rollback()
      },
    }
  }

  getLastInsertId(result: any): number {
    // MySQL returns insertId in result[0] (the result object)
    if (result && result.insertId) {
      return result.insertId
    }
    // If result is array, check second element
    if (Array.isArray(result) && result[1] && result[1].insertId) {
      return result[1].insertId
    }
    return 0
  }

  normalizeError(error: any): DatabaseError {
    // MySQL error codes
    if (error.code === 'ER_DUP_ENTRY' || error.code === 1062) {
      return { code: 'DUPLICATE_ENTRY', message: error.message }
    }
    if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 1146) {
      return { code: 'TABLE_NOT_FOUND', message: error.message }
    }
    if (error.code === 'ECONNREFUSED') {
      return { code: 'CONNECTION_REFUSED', message: error.message }
    }
    return { code: error.code || 'UNKNOWN_ERROR', message: error.message || 'Unknown error' }
  }

  quoteIdentifier(name: string): string {
    // MySQL uses backticks
    return `\`${name}\``
  }

  getDatabaseType(): 'mysql' | 'postgresql' {
    return 'mysql'
  }

  async testConnection(): Promise<boolean> {
    try {
      const connection = await this.pool.getConnection()
      connection.release()
      return true
    } catch (error) {
      console.error('MySQL connection test failed:', error)
      return false
    }
  }
}
