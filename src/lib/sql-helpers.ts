import type { DatabaseAdapter } from './db-adapter'

/**
 * SQL Helper Functions
 * Database-agnostic SQL generation helpers
 */

/**
 * Build AUTO_INCREMENT column definition
 */
export function buildAutoIncrement(adapter: DatabaseAdapter, useBigInt: boolean = false): string {
  if (adapter.getDatabaseType() === 'postgresql') {
    return useBigInt ? 'BIGSERIAL PRIMARY KEY' : 'SERIAL PRIMARY KEY'
  }
  return useBigInt ? 'BIGINT AUTO_INCREMENT PRIMARY KEY' : 'INT AUTO_INCREMENT PRIMARY KEY'
}

/**
 * Build ENUM column definition
 * MySQL: ENUM('value1', 'value2')
 * PostgreSQL: VARCHAR(255) CHECK (column IN ('value1', 'value2'))
 */
export function buildEnumColumn(
  adapter: DatabaseAdapter,
  columnName: string,
  values: string[],
  nullable: boolean = false
): string {
  const quotedName = adapter.quoteIdentifier(columnName)
  const nullableStr = nullable ? 'NULL' : 'NOT NULL'

  if (adapter.getDatabaseType() === 'postgresql') {
    const checkValues = values.map(v => `'${v.replace(/'/g, "''")}'`).join(', ')
    return `${quotedName} VARCHAR(255) ${nullableStr} CHECK (${columnName} IN (${checkValues}))`
  }

  // MySQL ENUM
  const enumValues = values.map(v => v.replace(/'/g, "''")).join("', '")
  return `${quotedName} ENUM('${enumValues}') ${nullableStr}`
}

/**
 * Build timestamp columns with auto-update
 * MySQL: ON UPDATE CURRENT_TIMESTAMP
 * PostgreSQL: Needs trigger (returned as separate trigger SQL)
 */
export function buildTimestampColumns(adapter: DatabaseAdapter): {
  createdAt: string
  updatedAt: string
  updateTrigger?: string // PostgreSQL trigger SQL
} {
  const createdAtCol = adapter.quoteIdentifier('created_at')
  const updatedAtCol = adapter.quoteIdentifier('updated_at')

  if (adapter.getDatabaseType() === 'postgresql') {
    return {
      createdAt: `${createdAtCol} TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
      updatedAt: `${updatedAtCol} TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
      updateTrigger: `
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$ language 'plpgsql';
      `,
    }
  }

  // MySQL
  return {
    createdAt: `${createdAtCol} TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
    updatedAt: `${updatedAtCol} TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  }
}

/**
 * Build INSERT query with RETURNING clause for PostgreSQL
 * or regular INSERT for MySQL
 */
export function buildInsertQuery(
  adapter: DatabaseAdapter,
  tableName: string,
  columns: string[],
  returnId: boolean = true
): string {
  const quotedTable = adapter.quoteIdentifier(tableName)
  const quotedColumns = columns.map(col => adapter.quoteIdentifier(col))
  const placeholders = adapter.getDatabaseType() === 'postgresql' 
    ? columns.map((_, i) => `$${i + 1}`).join(', ')
    : columns.map(() => '?').join(', ')

  let query = `INSERT INTO ${quotedTable} (${quotedColumns.join(', ')}) VALUES (${placeholders})`

  if (adapter.getDatabaseType() === 'postgresql' && returnId) {
    query += ' RETURNING id'
  }

  return query
}

/**
 * Get list tables query
 */
export function getListTablesQuery(adapter: DatabaseAdapter): string {
  if (adapter.getDatabaseType() === 'postgresql') {
    return `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
  }
  return 'SHOW TABLES'
}

/**
 * Parse table name from list tables result
 */
export function parseTableName(adapter: DatabaseAdapter, row: any): string {
  if (adapter.getDatabaseType() === 'postgresql') {
    return row.table_name
  }
  // MySQL returns object with key like { 'Tables_in_database': 'table_name' }
  return Object.values(row)[0] as string
}

/**
 * Build DROP TABLE query
 */
export function buildDropTableQuery(adapter: DatabaseAdapter, tableName: string, ifExists: boolean = true): string {
  const quotedTable = adapter.quoteIdentifier(tableName)
  const ifExistsClause = ifExists ? 'IF EXISTS' : ''
  return `DROP TABLE ${ifExistsClause} ${quotedTable}`
}

/**
 * Build foreign key check disable/enable (MySQL only)
 */
export function buildForeignKeyCheckQuery(adapter: DatabaseAdapter, enable: boolean): string | null {
  if (adapter.getDatabaseType() === 'postgresql') {
    // PostgreSQL doesn't have this, use transactions instead
    return null
  }
  return `SET FOREIGN_KEY_CHECKS = ${enable ? '1' : '0'}`
}

/**
 * Build INSERT ... ON DUPLICATE KEY UPDATE query
 * MySQL: INSERT ... ON DUPLICATE KEY UPDATE
 * PostgreSQL: INSERT ... ON CONFLICT ... DO UPDATE
 */
export function buildUpsertQuery(
  adapter: DatabaseAdapter,
  tableName: string,
  columns: string[],
  conflictColumns: string[],
  updateColumns: string[]
): string {
  const quotedTable = adapter.quoteIdentifier(tableName)
  const quotedColumns = columns.map(col => adapter.quoteIdentifier(col))
  const placeholders = adapter.getDatabaseType() === 'postgresql' 
    ? columns.map((_, i) => `$${i + 1}`).join(', ')
    : columns.map(() => '?').join(', ')

  let query = `INSERT INTO ${quotedTable} (${quotedColumns.join(', ')}) VALUES (${placeholders})`

  if (adapter.getDatabaseType() === 'postgresql') {
    // PostgreSQL uses ON CONFLICT
    const conflictCols = conflictColumns.map(col => adapter.quoteIdentifier(col)).join(', ')
    const updateSet = updateColumns.map((col, idx) => {
      const quotedCol = adapter.quoteIdentifier(col)
      const paramIndex = columns.length + idx + 1
      return `${quotedCol} = $${paramIndex}`
    }).join(', ')
    query += ` ON CONFLICT (${conflictCols}) DO UPDATE SET ${updateSet}`
  } else {
    // MySQL uses ON DUPLICATE KEY UPDATE
    const updateSet = updateColumns.map(col => {
      const quotedCol = adapter.quoteIdentifier(col)
      return `${quotedCol} = VALUES(${quotedCol})`
    }).join(', ')
    query += ` ON DUPLICATE KEY UPDATE ${updateSet}`
  }

  return query
}

/**
 * Build simple INSERT ... ON DUPLICATE KEY UPDATE with VALUES() syntax
 * For MySQL: VALUES(column_name)
 * For PostgreSQL: EXCLUDED.column_name
 */
export function buildSimpleUpsertQuery(
  adapter: DatabaseAdapter,
  tableName: string,
  columns: string[],
  conflictColumns: string[],
  updateColumns: string[]
): string {
  const quotedTable = adapter.quoteIdentifier(tableName)
  const quotedColumns = columns.map(col => adapter.quoteIdentifier(col))
  const placeholders = adapter.getDatabaseType() === 'postgresql' 
    ? columns.map((_, i) => `$${i + 1}`).join(', ')
    : columns.map(() => '?').join(', ')

  let query = `INSERT INTO ${quotedTable} (${quotedColumns.join(', ')}) VALUES (${placeholders})`

  if (adapter.getDatabaseType() === 'postgresql') {
    // PostgreSQL uses ON CONFLICT
    const conflictCols = conflictColumns.map(col => adapter.quoteIdentifier(col)).join(', ')
    const updateSet = updateColumns.map(col => {
      const quotedCol = adapter.quoteIdentifier(col)
      return `${quotedCol} = EXCLUDED.${quotedCol}`
    }).join(', ')
    query += ` ON CONFLICT (${conflictCols}) DO UPDATE SET ${updateSet}`
  } else {
    // MySQL uses ON DUPLICATE KEY UPDATE
    const updateSet = updateColumns.map(col => {
      const quotedCol = adapter.quoteIdentifier(col)
      return `${quotedCol} = VALUES(${quotedCol})`
    }).join(', ')
    query += ` ON DUPLICATE KEY UPDATE ${updateSet}`
  }

  return query
}

/**
 * Build CREATE INDEX query that is compatible with MySQL 8.4
 * MySQL 8.4 doesn't support IF NOT EXISTS for CREATE INDEX
 * So we need to check if index exists first or use error handling
 */
export function buildCreateIndexQuery(
  adapter: DatabaseAdapter,
  indexName: string,
  tableName: string,
  columns: string[],
  unique: boolean = false
): string {
  const quotedIndex = adapter.quoteIdentifier(indexName)
  const quotedTable = adapter.quoteIdentifier(tableName)
  const quotedColumns = columns.map(col => adapter.quoteIdentifier(col)).join(', ')
  const uniqueClause = unique ? 'UNIQUE' : ''
  
  if (adapter.getDatabaseType() === 'postgresql') {
    // PostgreSQL supports IF NOT EXISTS
    return `CREATE ${uniqueClause} INDEX IF NOT EXISTS ${quotedIndex} ON ${quotedTable} (${quotedColumns})`
  } else {
    // MySQL 8.4 doesn't support IF NOT EXISTS for CREATE INDEX
    // Return query without IF NOT EXISTS - caller should handle error if index exists
    return `CREATE ${uniqueClause} INDEX ${quotedIndex} ON ${quotedTable} (${quotedColumns})`
  }
}

/**
 * Check if index exists in database
 */
export function buildCheckIndexExistsQuery(
  adapter: DatabaseAdapter,
  indexName: string,
  tableName: string
): string {
  if (adapter.getDatabaseType() === 'postgresql') {
    return `
      SELECT COUNT(*) as count
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = $1
        AND indexname = $2
    `
  } else {
    // MySQL - use parameterized query
    return `
      SELECT COUNT(*) as count
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND index_name = ?
    `
  }
}
