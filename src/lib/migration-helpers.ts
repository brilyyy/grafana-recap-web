import type { QueryRunner } from 'typeorm'
import { getDatabaseAdapter } from './db-factory'
import {
  buildAutoIncrement,
  buildEnumColumn,
  buildTimestampColumns,
  buildDropTableQuery,
  buildForeignKeyCheckQuery,
  getListTablesQuery,
  parseTableName,
} from './sql-helpers'

/**
 * Migration Helpers
 * Database-agnostic migration helper functions
 */

/**
 * Create table with auto-increment primary key
 */
export async function createTableWithAutoIncrement(
  queryRunner: QueryRunner,
  tableName: string,
  columns: Array<{ name: string; definition: string }>,
  engine?: string
): Promise<void> {
  const adapter = getDatabaseAdapter()
  const quotedTable = adapter.quoteIdentifier(tableName)
  
  const idColumn = `id ${buildAutoIncrement(adapter)}`
  const otherColumns = columns.map(col => {
    const quotedName = adapter.quoteIdentifier(col.name)
    return `${quotedName} ${col.definition}`
  }).join(',\n    ')
  
  const engineClause = adapter.getDatabaseType() === 'mysql' && engine
    ? ` ENGINE=${engine} DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    : ''
  
  const query = `
    CREATE TABLE IF NOT EXISTS ${quotedTable} (
      ${idColumn},
      ${otherColumns}
    )${engineClause}
  `
  
  await queryRunner.query(query)
}

/**
 * Create ENUM column
 */
export function createEnumColumnDefinition(
  columnName: string,
  values: string[],
  nullable: boolean = false
): string {
  const adapter = getDatabaseAdapter()
  return buildEnumColumn(adapter, columnName, values, nullable)
}

/**
 * Create timestamp columns with auto-update
 */
export function createTimestampColumns(): {
  createdAt: string
  updatedAt: string
  updateTrigger?: string
} {
  const adapter = getDatabaseAdapter()
  return buildTimestampColumns(adapter)
}

/**
 * Create update trigger for PostgreSQL (if needed)
 */
export async function createUpdateTrigger(
  queryRunner: QueryRunner,
  tableName: string
): Promise<void> {
  const adapter = getDatabaseAdapter()
  
  if (adapter.getDatabaseType() === 'postgresql') {
    // Create trigger function if not exists
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `)
    
    // Create trigger for table
    const quotedTable = adapter.quoteIdentifier(tableName)
    const triggerName = adapter.quoteIdentifier(`update_${tableName}_updated_at`)
    
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS ${triggerName} ON ${quotedTable};
      CREATE TRIGGER ${triggerName}
        BEFORE UPDATE ON ${quotedTable}
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `)
  }
}

/**
 * Drop all tables in database
 */
export async function dropAllTables(queryRunner: QueryRunner): Promise<void> {
  const adapter = getDatabaseAdapter()
  
  // Get list of tables
  const listQuery = getListTablesQuery(adapter)
  const [tables] = await queryRunner.query(listQuery)
  
  // Disable foreign key checks for MySQL
  const fkCheckQuery = buildForeignKeyCheckQuery(adapter, false)
  if (fkCheckQuery) {
    await queryRunner.query(fkCheckQuery)
  }
  
  // Drop each table
  for (const row of tables) {
    const tableName = parseTableName(adapter, row)
    const dropQuery = buildDropTableQuery(adapter, tableName, true)
    await queryRunner.query(dropQuery)
  }
  
  // Re-enable foreign key checks for MySQL
  if (fkCheckQuery) {
    await queryRunner.query(buildForeignKeyCheckQuery(adapter, true)!)
  }
}

/**
 * Create index
 */
export async function createIndex(
  queryRunner: QueryRunner,
  tableName: string,
  indexName: string,
  columns: string[],
  unique: boolean = false
): Promise<void> {
  const adapter = getDatabaseAdapter()
  const quotedTable = adapter.quoteIdentifier(tableName)
  const quotedIndex = adapter.quoteIdentifier(indexName)
  const quotedColumns = columns.map(col => adapter.quoteIdentifier(col)).join(', ')
  const uniqueClause = unique ? 'UNIQUE' : ''
  
  const query = `CREATE ${uniqueClause} INDEX IF NOT EXISTS ${quotedIndex} ON ${quotedTable} (${quotedColumns})`
  await queryRunner.query(query)
}

/**
 * Create foreign key constraint
 */
export async function createForeignKey(
  queryRunner: QueryRunner,
  tableName: string,
  columnName: string,
  referencedTable: string,
  referencedColumn: string = 'id',
  onDelete: 'CASCADE' | 'SET NULL' | 'RESTRICT' = 'CASCADE'
): Promise<void> {
  const adapter = getDatabaseAdapter()
  const quotedTable = adapter.quoteIdentifier(tableName)
  const quotedColumn = adapter.quoteIdentifier(columnName)
  const quotedRefTable = adapter.quoteIdentifier(referencedTable)
  const quotedRefColumn = adapter.quoteIdentifier(referencedColumn)
  const fkName = adapter.quoteIdentifier(`fk_${tableName}_${columnName}`)
  
  const query = `
    ALTER TABLE ${quotedTable}
    ADD CONSTRAINT ${fkName}
    FOREIGN KEY (${quotedColumn})
    REFERENCES ${quotedRefTable}(${quotedRefColumn})
    ON DELETE ${onDelete}
  `
  
  await queryRunner.query(query)
}
