import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres'
import { Pool as PgPool } from 'pg'
import { env } from '@/env'
import * as pgSchema from './schema'

function createPgDb() {
  const pool = new PgPool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    max: 10,
    idleTimeoutMillis: 600000,
    connectionTimeoutMillis: 600000,
  })
  return drizzlePg(pool, { schema: pgSchema })
}

declare global {
  // eslint-disable-next-line no-var
  var __drizzleDb: ReturnType<typeof createPgDb> | undefined
}

function getDb() {
  if (!global.__drizzleDb) {
    global.__drizzleDb = createPgDb()
  }
  return global.__drizzleDb
}

export const db = getDb()

export type PgDB = ReturnType<typeof createPgDb>
export type DB = PgDB

export { pgSchema }
