import { defineConfig } from 'drizzle-kit'
import * as dotenv from 'dotenv'

dotenv.config()

const dbType = (process.env.DB_TYPE || 'mysql').toLowerCase()
const isPostgres = dbType === 'postgresql' || dbType === 'postgres'

// Each dialect gets its own snapshot folder so migrations for MySQL and
// PostgreSQL never conflict when you switch DB_TYPE and run drizzle:generate.
export default defineConfig({
  dialect: isPostgres ? 'postgresql' : 'mysql',
  schema: isPostgres
    ? './src/db/schema/pg.ts'
    : './src/db/schema/mysql.ts',
  out: isPostgres ? './drizzle/pg' : './drizzle/mysql',
  dbCredentials: isPostgres
    ? {
        host: process.env.DB_HOST!,
        port: parseInt(process.env.DB_PORT || '5432'),
        user: process.env.DB_USER!,
        password: process.env.DB_PASSWORD!,
        database: process.env.DB_NAME!,
        ssl: false,
      }
    : {
        host: process.env.DB_HOST!,
        port: parseInt(process.env.DB_PORT || '3306'),
        user: process.env.DB_USER!,
        password: process.env.DB_PASSWORD!,
        database: process.env.DB_NAME!,
      },
})
