import type { DatabaseAdapter } from './db-adapter'
import { MySQLAdapter } from './adapters/mysql-adapter'
import { PostgreSQLAdapter } from './adapters/postgresql-adapter'

/**
 * Database Factory
 * Creates appropriate database adapter based on DB_TYPE environment variable
 */
let adapterInstance: DatabaseAdapter | null = null

export function createDatabaseAdapter(): DatabaseAdapter {
  // Return cached instance if exists
  if (adapterInstance) {
    return adapterInstance
  }

  const dbType = (process.env.DB_TYPE || 'mysql').toLowerCase()

  if (dbType === 'postgresql' || dbType === 'postgres') {
    adapterInstance = new PostgreSQLAdapter()
    console.log('✅ Using PostgreSQL adapter')
  } else {
    adapterInstance = new MySQLAdapter()
    console.log('✅ Using MySQL adapter')
  }

  return adapterInstance
}

/**
 * Get current database adapter instance
 */
export function getDatabaseAdapter(): DatabaseAdapter {
  if (!adapterInstance) {
    return createDatabaseAdapter()
  }
  return adapterInstance
}

/**
 * Reset adapter instance (useful for testing)
 */
export function resetDatabaseAdapter(): void {
  adapterInstance = null
}
