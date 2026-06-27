import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '@/env'
import * as pgSchema from './schema'

function createPgDb() {
  const client = postgres({
    host: env.DB_HOST,
    port: env.DB_PORT,
    username: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    max: 10,
    idle_timeout: 600,
    connect_timeout: 600,
  })
  return drizzle(client, { schema: pgSchema })
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

export type PgDB = PostgresJsDatabase<typeof pgSchema>
export type DB = PgDB

export { pgSchema }
