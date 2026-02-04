import { getDatabaseAdapter } from './db-factory'
import type { DatabaseAdapter } from './db-adapter'

// Get database adapter instance
const adapter = getDatabaseAdapter()

/**
 * Database pool wrapper for backward compatibility
 * Maintains the same interface as mysql2 pool
 */
const pool = {
  /**
   * Execute a prepared statement query
   * Returns [rows, result] format similar to mysql2
   */
  async execute(query: string, params?: any[]): Promise<[any[], any]> {
    return adapter.execute(query, params)
  },

  /**
   * Execute a regular query
   * Returns [rows, result] format similar to mysql2
   */
  async query(query: string, params?: any[]): Promise<[any[], any]> {
    return adapter.query(query, params)
  },

  /**
   * Get a connection from the pool
   */
  async getConnection() {
    return adapter.getConnection()
  },
}

// Test database connection
export async function testDatabaseConnection() {
  try {
    const success = await adapter.testConnection()
    if (success) {
      console.log('✅ Database connected successfully!')
      console.log(`   Type: ${adapter.getDatabaseType()}`)
      console.log(`   Host: ${process.env.DB_HOST}`)
      console.log(`   Port: ${process.env.DB_PORT}`)
      console.log(`   Database: ${process.env.DB_NAME}`)
      console.log(`   User: ${process.env.DB_USER}`)
    }
    return success
  } catch (error) {
    console.error('❌ Database connection failed:', error)
    return false
  }
}

// Export adapter for advanced usage
export { adapter }
export type { DatabaseAdapter }

// Export pool for backward compatibility
export default pool

