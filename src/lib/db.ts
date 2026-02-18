import { getDatabaseAdapter } from './db-factory.ts'
import type { DatabaseAdapter } from './db-adapter.ts'

let adapter: DatabaseAdapter | null = null

function getAdapter(): DatabaseAdapter {
  if (!adapter) {
    adapter = getDatabaseAdapter()
  }
  return adapter
}

const pool = {
  async execute(query: string, params?: any[]): Promise<[any[], any]> {
    return getAdapter().execute(query, params)
  },
  async query(query: string, params?: any[]): Promise<[any[], any]> {
    return getAdapter().query(query, params)
  },

  async getConnection() {
    return getAdapter().getConnection()
  },
}

export async function testDatabaseConnection() {
  const db = getAdapter()
  try {
    const success = await db.testConnection()
    if (success) {
      console.log('✅ Database connected successfully!')
      console.log(`Type: ${db.getDatabaseType()}`)
    }
    return success
  }
  catch (error) {
    console.error('Database connection failed:', error)
    return false
  }
}
export function getDb(): DatabaseAdapter {
  return getAdapter()
}
export default pool