import { drizzle as drizzleMysql } from 'drizzle-orm/mysql2'
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres'
import mysql from 'mysql2/promise'
import { Pool as PgPool } from 'pg'
import { env } from '@/env'
import * as mysqlSchema from './schema/mysql'
import * as pgSchema from './schema/pg'

const isPostgres =
  env.DB_TYPE === 'postgresql' || env.DB_TYPE === 'postgres'

/**
 * @deprecated MySQL is deprecated. Use PostgreSQL + pg_cron instead.
 */
function createMysqlDb() {
  const pool = mysql.createPool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 600000,
  })
  return drizzleMysql(pool, { schema: mysqlSchema, mode: 'default' })
}

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
  var __drizzleDb: ReturnType<typeof createMysqlDb> | ReturnType<typeof createPgDb> | undefined
}

function getDb() {
  if (!global.__drizzleDb) {
    global.__drizzleDb = isPostgres ? createPgDb() : createMysqlDb()
  }
  return global.__drizzleDb
}

export const db = getDb()

export type MysqlDB = ReturnType<typeof createMysqlDb>
export type PgDB = ReturnType<typeof createPgDb>
export type DB = MysqlDB | PgDB

export { mysqlSchema, pgSchema }
