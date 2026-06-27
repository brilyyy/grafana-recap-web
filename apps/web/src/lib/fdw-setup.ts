import type { Sql } from 'postgres'
import { getLogger } from '@/lib/logger'
import { fdwLocalRelationName } from './fdw'

export interface FdwSetupResult {
  serversProcessed: number
  tablesProcessed: number
  errors: string[]
}

const log = getLogger('fdw')

/**
 * Execute all FDW configuration from fdw_source_table.
 *
 * Drops and recreates foreign servers, user mappings, foreign tables,
 * and compatibility views for every row in fdw_source_table.
 */
export async function applyFdwConfig(sqlClient: Sql): Promise<FdwSetupResult> {
  const start = performance.now()
  log.debug('applyFdwConfig start')
  const result: FdwSetupResult = { serversProcessed: 0, tablesProcessed: 0, errors: [] }

  const DB_HOST = process.env.DB_HOST ?? 'localhost'
  const DB_PORT = process.env.DB_PORT ?? '5432'
  const DB_USER = process.env.DB_USER ?? 'root'
  const DB_PASSWORD = process.env.DB_PASSWORD ?? ''
  const DB_USER_TARGET = process.env.DB_USER_TARGET?.trim() || null
  const DB_USER_DATA_VIEWER = process.env.DB_USER_DATA_VIEWER?.trim() || null
  const targetUsers = [DB_USER_TARGET, DB_USER_DATA_VIEWER].filter(Boolean) as string[]

  async function exec(text: string): Promise<unknown[]> {
    return await sqlClient.unsafe(text)
  }

  async function tableExists(table: string): Promise<boolean> {
    const rows = await exec(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='${table.replace(/'/g, "''")}')`,
    )
    return !!(rows[0] as Record<string, unknown>)?.exists
  }

  // 1. Ensure extension
  try {
    await exec('CREATE EXTENSION IF NOT EXISTS postgres_fdw')
  } catch (e: unknown) {
    result.errors.push(`postgres_fdw extension: ${(e as Error).message}`)
    return result
  }

  // 2. Load fdw_source_table rows
  const pairs = new Map<string, { tables: Set<string>; host: string }>()
  if (await tableExists('fdw_source_table')) {
    const fdwRows = (await exec(
      `SELECT source_db_name, table_name, host FROM "fdw_source_table" ORDER BY source_db_name, table_name`,
    )) as { source_db_name: string; table_name: string; host: string | null }[]
    for (const r of fdwRows) {
      if (!pairs.has(r.source_db_name)) pairs.set(r.source_db_name, { tables: new Set(), host: r.host ?? DB_HOST })
      pairs.get(r.source_db_name)!.tables.add(r.table_name)
    }
  }

  // 3. Process each source DB
  const claimedViewNames = new Set<string>()
  const esc = (s: string) => s.replace(/'/g, "''")

  for (const [dbName, { tables, host }] of pairs) {
    const serverName = `${dbName}_server`
    try {
      await exec(`DROP SERVER IF EXISTS "${serverName}" CASCADE`)
      await exec(`
        CREATE SERVER "${serverName}"
        FOREIGN DATA WRAPPER postgres_fdw
        OPTIONS (host '${esc(host)}', dbname '${esc(dbName)}', port '${esc(DB_PORT)}')
      `)
      await exec(`
        CREATE USER MAPPING IF NOT EXISTS FOR CURRENT_USER
        SERVER "${serverName}"
        OPTIONS (user '${esc(DB_USER)}', password '${esc(DB_PASSWORD)}')
      `)
      for (const targetUser of targetUsers) {
        const targetEsc = targetUser.replace(/"/g, '""')
        try {
          await exec(`
            CREATE USER MAPPING IF NOT EXISTS FOR "${targetEsc}"
            SERVER "${serverName}"
            OPTIONS (user '${esc(DB_USER)}', password '${esc(DB_PASSWORD)}')
          `)
          await exec(`
            ALTER USER MAPPING FOR "${targetEsc}" SERVER "${serverName}"
            OPTIONS (SET user '${esc(DB_USER)}', SET password '${esc(DB_PASSWORD)}')
          `)
        } catch (e: unknown) {
          result.errors.push(`User mapping ${targetUser} on ${serverName}: ${(e as Error).message}`)
        }
        try {
          await exec(`GRANT USAGE ON FOREIGN SERVER "${serverName}" TO "${targetEsc}"`)
        } catch (e: unknown) {
          result.errors.push(`GRANT USAGE on ${serverName}: ${(e as Error).message}`)
        }
      }
      result.serversProcessed++

      for (const tableName of tables) {
        const localFtName = fdwLocalRelationName(dbName, tableName)
        try {
          await exec(`DROP SCHEMA IF EXISTS _fdw_import_tmp CASCADE`)
          await exec(`CREATE SCHEMA _fdw_import_tmp`)
          await exec(`
            IMPORT FOREIGN SCHEMA public
            LIMIT TO ("${tableName}")
            FROM SERVER "${serverName}"
            INTO _fdw_import_tmp
          `)
          await exec(`ALTER FOREIGN TABLE _fdw_import_tmp."${tableName}" RENAME TO "${localFtName}"`)
          await exec(`ALTER FOREIGN TABLE _fdw_import_tmp."${localFtName}" SET SCHEMA public`)
          await exec(`DROP SCHEMA _fdw_import_tmp`)

          for (const targetUser of targetUsers) {
            try {
              await exec(`GRANT SELECT ON "${localFtName}" TO "${targetUser.replace(/"/g, '""')}"`)
            } catch (e: unknown) {
              result.errors.push(`GRANT SELECT on ${localFtName}: ${(e as Error).message}`)
            }
          }

          if (!claimedViewNames.has(tableName)) {
            claimedViewNames.add(tableName)
            await exec(`CREATE OR REPLACE VIEW "${tableName}" AS SELECT * FROM "${localFtName}"`)
            for (const targetUser of targetUsers) {
              try {
                await exec(`GRANT SELECT ON "${tableName}" TO "${targetUser.replace(/"/g, '""')}"`)
              } catch (e: unknown) {
                result.errors.push(`GRANT SELECT on view ${tableName}: ${(e as Error).message}`)
              }
            }
          }
          result.tablesProcessed++
        } catch (e: unknown) {
          try {
            await exec(`DROP SCHEMA IF EXISTS _fdw_import_tmp CASCADE`)
          } catch {
            /* ignore */
          }
          result.errors.push(`FDW for ${dbName}.${tableName}: ${(e as Error).message}`)
        }
      }
    } catch (e: unknown) {
      result.errors.push(`FDW server ${serverName}: ${(e as Error).message}`)
    }
  }

  log.info({ durationMs: Math.round((performance.now() - start) * 100) / 100, status: 'success' }, 'applyFdwConfig ok')
  return result
}

// ponytail: withLogging wrapper removed — inline logging added above
