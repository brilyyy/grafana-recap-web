import { Pool, PoolClient } from 'pg'
import type { DatabaseAdapter, DatabaseConnection, DatabaseError } from '../db-adapter'

/**
 * PostgreSQL Database Adapter
 * Implements DatabaseAdapter interface for PostgreSQL
 */
export class PostgreSQLAdapter implements DatabaseAdapter {
  private pool: Pool

  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      max: 10,
      idleTimeoutMillis: 600000, // 10 minutes - keep connections alive longer for large file uploads
      connectionTimeoutMillis: 600000, // 10 minutes - allow enough time for connection establishment
      statement_timeout: 1800000, // 30 minutes timeout for individual queries (for very large files)
      query_timeout: 1800000, // 30 minutes timeout for queries
    })
  }

  async execute(query: string, params?: any[]): Promise<[any[], any]> {
    // PostgreSQL uses $1, $2, etc. for parameters
    // Convert ? placeholders to $1, $2, etc.
    const convertedQuery = this.convertPlaceholders(query)
    const result = await this.pool.query(convertedQuery, params)
    return [result.rows, result]
  }

  async query(query: string, params?: any[]): Promise<[any[], any]> {
    // PostgreSQL uses $1, $2, etc. for parameters
    const convertedQuery = this.convertPlaceholders(query)
    const result = await this.pool.query(convertedQuery, params)
    return [result.rows, result]
  }

  async getConnection(): Promise<DatabaseConnection> {
    const client = await this.pool.connect()
    // Set very long timeout for large file uploads (30 minutes = 1800000ms)
    await client.query('SET statement_timeout = 1800000')
    await client.query('SET idle_in_transaction_session_timeout = 1800000')
    
    return {
      release: () => client.release(),
      execute: async (query: string, params?: any[]) => {
        const convertedQuery = this.convertPlaceholders(query)
        const result = await client.query(convertedQuery, params)
        return [result.rows, result]
      },
      query: async (query: string, params?: any[]) => {
        const convertedQuery = this.convertPlaceholders(query)
        const result = await client.query(convertedQuery, params)
        return [result.rows, result]
      },
      beginTransaction: async () => {
        await client.query('BEGIN')
      },
      commit: async () => {
        await client.query('COMMIT')
      },
      rollback: async () => {
        await client.query('ROLLBACK')
      },
    }
  }

  getLastInsertId(result: any): number {
    // PostgreSQL uses RETURNING clause, so check result.rows[0].id
    if (result && result.rows && result.rows[0] && result.rows[0].id) {
      return result.rows[0].id
    }
    // If result is array, check first element
    if (Array.isArray(result) && result[0] && result[0].rows && result[0].rows[0] && result[0].rows[0].id) {
      return result[0].rows[0].id
    }
    // Fallback: check if result has insertId (for compatibility)
    if (result && result.insertId) {
      return result.insertId
    }
    return 0
  }

  normalizeError(error: any): DatabaseError {
    // PostgreSQL error codes
    if (error.code === '23505') {
      // Unique violation
      return { code: 'DUPLICATE_ENTRY', message: error.message }
    }
    if (error.code === '42P01') {
      // Undefined table
      return { code: 'TABLE_NOT_FOUND', message: error.message }
    }
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return { code: 'CONNECTION_REFUSED', message: error.message }
    }
    return { code: error.code || 'UNKNOWN_ERROR', message: error.message || 'Unknown error' }
  }

  quoteIdentifier(name: string): string {
    // PostgreSQL uses double quotes
    return `"${name}"`
  }

  getDatabaseType(): 'mysql' | 'postgresql' {
    return 'postgresql'
  }

  async testConnection(): Promise<boolean> {
    try {
      const client = await this.pool.connect()
      client.release()
      return true
    } catch (error) {
      console.error('PostgreSQL connection test failed:', error)
      return false
    }
  }

  /**
   * Convert MySQL-style ? placeholders to PostgreSQL $1, $2, etc.
   * Handles string literals and comments properly
   */
  private convertPlaceholders(query: string): string {
    let paramIndex = 1
    let inString = false
    let stringChar = ''
    let result = ''
    
    for (let i = 0; i < query.length; i++) {
      const char = query[i]
      const prevChar = i > 0 ? query[i - 1] : ''
      
      // Handle string literals
      if ((char === '"' || char === "'") && prevChar !== '\\') {
        if (!inString) {
          inString = true
          stringChar = char
        } else if (char === stringChar) {
          inString = false
          stringChar = ''
        }
        result += char
      } else if (char === '?' && !inString) {
        result += `$${paramIndex++}`
      } else {
        result += char
      }
    }
    
    return result
  }
}
