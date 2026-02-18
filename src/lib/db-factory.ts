import type { DatabaseAdapter } from './db-adapter.ts'
import { MySQLAdapter } from './adapters/mysql-adapter.ts'
import { PostgreSQLAdapter } from './adapters/postgresql-adapter.ts'

/**
 * Extend global type
 */
declare global {

  // eslint-disable-next-line no-var
  var __databaseAdapter: DatabaseAdapter | undefined

}

/**
 * Create new adapter instance
 */
function createAdapter(): DatabaseAdapter {

  const dbType = (process.env.DB_TYPE || 'mysql').toLowerCase()

  if (dbType === 'postgresql' || dbType === 'postgres') {

    console.log('✅ Using PostgreSQL adapter')

    return new PostgreSQLAdapter()

  }

  console.log('✅ Using MySQL adapter')

  return new MySQLAdapter()

}

/**
 * Get singleton adapter instance (GLOBAL SAFE)
 */
export function getDatabaseAdapter(): DatabaseAdapter {

  if (!global.__databaseAdapter) {

    global.__databaseAdapter = createAdapter()

  }

  return global.__databaseAdapter

}

/**
 * Reset adapter (testing only)
 */
export function resetDatabaseAdapter(): void {

  global.__databaseAdapter = undefined

}
