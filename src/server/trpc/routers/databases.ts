import { sql } from 'drizzle-orm'
import { db } from '@/db'
import { env } from '@/env'
import { router, superAdminProcedure } from '../init'

interface DatabaseRow {
  datname: string
  isCurrent: boolean
  hasForeignServer: boolean
  sourceTableCount: number
  isFdwed: boolean
}

export const databasesRouter = router({
  list: superAdminProcedure.query(async (): Promise<{ success: true; data: { databases: DatabaseRow[] } }> => {
    // 1. All non-template, connectable databases on this Postgres server
    const pgDbResult = await db.execute(
      sql`SELECT datname FROM pg_database WHERE datistemplate = false AND datallowconn ORDER BY datname`,
    )
    const datnames = (pgDbResult.rows as { datname: string }[]).map((r) => r.datname)

    // 2. Foreign servers provisioned via FDW (naming convention: <dbname>_server)
    const srvResult = await db.execute(sql`SELECT srvname FROM pg_foreign_server`)
    const foreignServerNames = new Set((srvResult.rows as { srvname: string }[]).map((r) => r.srvname))

    // 3. fdw_source_table counts per source DB (gracefully skip if table doesn't exist yet)
    const sourceCountMap = new Map<string, number>()
    try {
      const fdwResult = await db.execute(
        sql`SELECT source_db_name, count(*)::int AS n FROM fdw_source_table GROUP BY source_db_name`,
      )
      for (const row of fdwResult.rows as { source_db_name: string; n: number }[]) {
        sourceCountMap.set(row.source_db_name, Number(row.n))
      }
    } catch {
      // fdw_source_table not yet created — ignore
    }

    const databases: DatabaseRow[] = datnames.map((datname) => {
      const hasForeignServer = foreignServerNames.has(`${datname}_server`)
      const sourceTableCount = sourceCountMap.get(datname) ?? 0
      return {
        datname,
        isCurrent: datname === env.DB_NAME,
        hasForeignServer,
        sourceTableCount,
        isFdwed: hasForeignServer || sourceTableCount > 0,
      }
    })

    return { success: true, data: { databases } }
  }),
})
