import { MigrationInterface, QueryRunner } from 'typeorm'
import { getDatabaseAdapter } from '../lib/db-factory'
import {
  buildCreateIndexQuery,
  buildCheckIndexExistsQuery,
} from '../lib/sql-helpers'

export class AddPerformanceIndexes1771402669476 implements MigrationInterface {
  name = 'AddPerformanceIndexes1771402669476'

  private getAdapter() {
    return getDatabaseAdapter()
  }

  private quoteIdentifier(name: string): string {
    return this.getAdapter().quoteIdentifier(name)
  }

  /**
   * Create index safely - check if exists first for MySQL 8.4 compatibility
   * MySQL 8.4 doesn't support IF NOT EXISTS for CREATE INDEX
   */
  private async createIndexSafely(
    queryRunner: QueryRunner,
    indexName: string,
    tableName: string,
    columns: string[],
    unique: boolean = false
  ): Promise<void> {
    const adapter = this.getAdapter()
    const isPostgres = adapter.getDatabaseType() === 'postgresql'
    
    if (isPostgres) {
      // PostgreSQL supports IF NOT EXISTS
      const query = buildCreateIndexQuery(adapter, indexName, tableName, columns, unique)
      await queryRunner.query(query)
    } else {
      // MySQL 8.4 - check if index exists first
      const checkQuery = buildCheckIndexExistsQuery(adapter, indexName, tableName)
      const [result]: any = await queryRunner.query(checkQuery, [tableName, indexName])
      const indexExists = result[0]?.count > 0
      
      if (!indexExists) {
        const createQuery = buildCreateIndexQuery(adapter, indexName, tableName, columns, unique)
        await queryRunner.query(createQuery)
      }
    }
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. app_success_rate table indexes
    await this.createIndexSafely(
      queryRunner,
      'idx_app_success_rate_id_app_jenis_transaksi',
      'app_success_rate',
      ['id_app_identifier', 'jenis_transaksi']
    )

    await this.createIndexSafely(
      queryRunner,
      'idx_app_success_rate_id_app_rc',
      'app_success_rate',
      ['id_app_identifier', 'rc']
    )

    await this.createIndexSafely(
      queryRunner,
      'idx_app_success_rate_id_app_error_type',
      'app_success_rate',
      ['id_app_identifier', 'error_type']
    )

    await this.createIndexSafely(
      queryRunner,
      'idx_app_success_rate_id_app_bulan_tahun',
      'app_success_rate',
      ['id_app_identifier', 'bulan', 'tahun']
    )

    await this.createIndexSafely(
      queryRunner,
      'idx_app_success_rate_rc',
      'app_success_rate',
      ['rc']
    )

    // 2. response_code_dictionary table indexes
    await this.createIndexSafely(
      queryRunner,
      'idx_response_code_dictionary_id_app_error_type',
      'response_code_dictionary',
      ['id_app_identifier', 'error_type']
    )

    await this.createIndexSafely(
      queryRunner,
      'idx_response_code_dictionary_jenis_transaksi',
      'response_code_dictionary',
      ['jenis_transaksi']
    )

    // 3. unmapped_rc table indexes
    await this.createIndexSafely(
      queryRunner,
      'idx_unmapped_rc_id_app_identifier',
      'unmapped_rc',
      ['id_app_identifier']
    )

    // 4. app_processing_log table indexes
    await this.createIndexSafely(
      queryRunner,
      'idx_app_processing_log_processing_date',
      'app_processing_log',
      ['processing_date']
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const adapter = this.getAdapter()
    const isPostgres = adapter.getDatabaseType() === 'postgresql'
    
    // List of all indexes to drop
    const indexes = [
      { table: 'app_success_rate', index: 'idx_app_success_rate_id_app_jenis_transaksi' },
      { table: 'app_success_rate', index: 'idx_app_success_rate_id_app_rc' },
      { table: 'app_success_rate', index: 'idx_app_success_rate_id_app_error_type' },
      { table: 'app_success_rate', index: 'idx_app_success_rate_id_app_bulan_tahun' },
      { table: 'app_success_rate', index: 'idx_app_success_rate_rc' },
      { table: 'response_code_dictionary', index: 'idx_response_code_dictionary_id_app_error_type' },
      { table: 'response_code_dictionary', index: 'idx_response_code_dictionary_jenis_transaksi' },
      { table: 'unmapped_rc', index: 'idx_unmapped_rc_id_app_identifier' },
      { table: 'app_processing_log', index: 'idx_app_processing_log_processing_date' },
    ]

    for (const { table, index } of indexes) {
      const quotedTable = this.quoteIdentifier(table)
      const quotedIndex = this.quoteIdentifier(index)
      
      try {
        if (isPostgres) {
          await queryRunner.query(`DROP INDEX IF EXISTS ${quotedIndex}`)
        } else {
          await queryRunner.query(`DROP INDEX ${quotedIndex} ON ${quotedTable}`)
        }
      } catch (error: any) {
        // Ignore errors if index doesn't exist
        const isNotFoundError = 
          error.code === '42704' || // PostgreSQL: undefined_object
          error.code === 'ER_CANT_DROP_FIELD_OR_KEY' || // MySQL: Can't DROP
          error.errno === 1091 || // MySQL: Key doesn't exist
          (error.message && (
            error.message.includes('does not exist') ||
            error.message.includes('Unknown key')
          ))
        
        if (!isNotFoundError) {
          throw error
        }
      }
    }
  }
}
