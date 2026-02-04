import { MigrationInterface, QueryRunner } from 'typeorm'
import { getDatabaseAdapter } from '../lib/db-factory'
import {
  buildAutoIncrement,
  buildEnumColumn,
  buildTimestampColumns,
  buildDropTableQuery,
} from '../lib/sql-helpers'

export class InitialSchema1770030366139 implements MigrationInterface {
  name = 'InitialSchema1770030366139'

  private getAdapter() {
    return getDatabaseAdapter()
  }

  private quoteIdentifier(name: string): string {
    return this.getAdapter().quoteIdentifier(name)
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const adapter = this.getAdapter()
    const isPostgres = adapter.getDatabaseType() === 'postgresql'
    const timestamps = buildTimestampColumns(adapter)
    const engineClause = isPostgres ? '' : ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    
    // Create update trigger function for PostgreSQL (once, before creating tables)
    if (isPostgres && timestamps.updateTrigger) {
      await queryRunner.query(timestamps.updateTrigger)
    }
    
    // Create app_identifier table
    const appIdentifierTable = this.quoteIdentifier('app_identifier')
    const appNameCol = this.quoteIdentifier('app_name')
    const idxAppName = this.quoteIdentifier('idx_app_name')
    
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ${appIdentifierTable} (
        ${this.quoteIdentifier('id')} ${buildAutoIncrement(adapter)},
        ${appNameCol} VARCHAR(255) NOT NULL UNIQUE,
        ${timestamps.createdAt},
        ${timestamps.updatedAt}
      )${engineClause}
    `)
    
    // Create index
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ${idxAppName} ON ${appIdentifierTable} (${appNameCol})
    `)
    
    // Create update trigger for PostgreSQL
    if (isPostgres) {
      await queryRunner.query(`
        DROP TRIGGER IF EXISTS ${this.quoteIdentifier('update_app_identifier_updated_at')} ON ${appIdentifierTable};
        CREATE TRIGGER ${this.quoteIdentifier('update_app_identifier_updated_at')}
          BEFORE UPDATE ON ${appIdentifierTable}
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
      `)
    }

    // Create app_success_rate table
    const appSuccessRateTable = this.quoteIdentifier('app_success_rate')
    const errorTypeCol = buildEnumColumn(adapter, 'error_type', ['S', 'N', 'Sukses'], true)
    
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ${appSuccessRateTable} (
        ${this.quoteIdentifier('id')} ${buildAutoIncrement(adapter)},
        ${this.quoteIdentifier('id_app_identifier')} INT NOT NULL,
        ${this.quoteIdentifier('tanggal_transaksi')} DATE NOT NULL,
        ${this.quoteIdentifier('bulan')} VARCHAR(20) NOT NULL,
        ${this.quoteIdentifier('tahun')} INT NOT NULL,
        ${this.quoteIdentifier('jenis_transaksi')} VARCHAR(255) NOT NULL,
        ${this.quoteIdentifier('rc')} VARCHAR(50) NULL,
        ${this.quoteIdentifier('rc_description')} VARCHAR(500) NULL,
        ${this.quoteIdentifier('total_transaksi')} INT NULL,
        ${this.quoteIdentifier('total_nominal')} DECIMAL(20, 2) NULL,
        ${this.quoteIdentifier('total_biaya_admin')} DECIMAL(20, 2) NULL,
        ${this.quoteIdentifier('status_transaksi')} VARCHAR(255) NULL,
        ${errorTypeCol},
        ${timestamps.createdAt},
        ${timestamps.updatedAt}
      )${engineClause}
    `)
    
    // Create indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ${this.quoteIdentifier('idx_tanggal_transaksi')} ON ${appSuccessRateTable} (${this.quoteIdentifier('tanggal_transaksi')})
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ${this.quoteIdentifier('idx_id_app_identifier')} ON ${appSuccessRateTable} (${this.quoteIdentifier('id_app_identifier')})
    `)
    
    // Create foreign key
    await queryRunner.query(`
      ALTER TABLE ${appSuccessRateTable}
      ADD CONSTRAINT ${this.quoteIdentifier('fk_app_success_rate_id_app_identifier')}
      FOREIGN KEY (${this.quoteIdentifier('id_app_identifier')})
      REFERENCES ${appIdentifierTable}(${this.quoteIdentifier('id')})
      ON DELETE CASCADE
    `)
    
    // Create update trigger for PostgreSQL
    if (isPostgres) {
      await queryRunner.query(`
        DROP TRIGGER IF EXISTS ${this.quoteIdentifier('update_app_success_rate_updated_at')} ON ${appSuccessRateTable};
        CREATE TRIGGER ${this.quoteIdentifier('update_app_success_rate_updated_at')}
          BEFORE UPDATE ON ${appSuccessRateTable}
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
      `)
    }

    // Create response_code_dictionary table
    const dictionaryTable = this.quoteIdentifier('response_code_dictionary')
    const errorTypeColDict = buildEnumColumn(adapter, 'error_type', ['S', 'N', 'Sukses'], false)
    
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ${dictionaryTable} (
        ${this.quoteIdentifier('id')} ${buildAutoIncrement(adapter)},
        ${this.quoteIdentifier('id_app_identifier')} INT NOT NULL,
        ${this.quoteIdentifier('jenis_transaksi')} VARCHAR(255) NULL,
        ${this.quoteIdentifier('rc')} VARCHAR(50) NULL,
        ${this.quoteIdentifier('rc_description')} VARCHAR(500) NULL,
        ${errorTypeColDict}
      )${engineClause}
    `)
    
    // Create foreign key
    await queryRunner.query(`
      ALTER TABLE ${dictionaryTable}
      ADD CONSTRAINT ${this.quoteIdentifier('fk_response_code_dictionary_id_app_identifier')}
      FOREIGN KEY (${this.quoteIdentifier('id_app_identifier')})
      REFERENCES ${appIdentifierTable}(${this.quoteIdentifier('id')})
      ON DELETE CASCADE
    `)
    
    // Create unique constraint
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ${this.quoteIdentifier('unique_dictionary_entry')}
      ON ${dictionaryTable} (${this.quoteIdentifier('id_app_identifier')}, ${this.quoteIdentifier('jenis_transaksi')}, ${this.quoteIdentifier('rc')})
    `)

    // Create unmapped_rc table
    const unmappedRcTable = this.quoteIdentifier('unmapped_rc')
    const errorTypeColUnmapped = buildEnumColumn(adapter, 'error_type', ['S', 'N', 'Sukses'], true)
    
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ${unmappedRcTable} (
        ${this.quoteIdentifier('id')} ${buildAutoIncrement(adapter)},
        ${this.quoteIdentifier('id_app_identifier')} INT NOT NULL,
        ${this.quoteIdentifier('jenis_transaksi')} VARCHAR(255) NULL,
        ${this.quoteIdentifier('rc')} VARCHAR(50) NULL,
        ${this.quoteIdentifier('rc_description')} VARCHAR(500) NULL,
        ${this.quoteIdentifier('status_transaksi')} VARCHAR(255) NULL,
        ${errorTypeColUnmapped},
        ${timestamps.createdAt}
      )${engineClause}
    `)
    
    // Create foreign key
    await queryRunner.query(`
      ALTER TABLE ${unmappedRcTable}
      ADD CONSTRAINT ${this.quoteIdentifier('fk_unmapped_rc_id_app_identifier')}
      FOREIGN KEY (${this.quoteIdentifier('id_app_identifier')})
      REFERENCES ${appIdentifierTable}(${this.quoteIdentifier('id')})
      ON DELETE CASCADE
    `)
    
    // Create unique constraint
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ${this.quoteIdentifier('unique_unmapped_entry')}
      ON ${unmappedRcTable} (${this.quoteIdentifier('id_app_identifier')}, ${this.quoteIdentifier('jenis_transaksi')}, ${this.quoteIdentifier('rc')})
    `)

    // Create users table with superadmin role
    const usersTable = this.quoteIdentifier('users')
    const roleCol = buildEnumColumn(adapter, 'role', ['superadmin', 'admin', 'user'], false)
    const defaultRole = "DEFAULT 'user'"
    // Add DEFAULT to role column
    const roleColWithDefault = roleCol.replace('NOT NULL', `NOT NULL ${defaultRole}`)
    
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ${usersTable} (
        ${this.quoteIdentifier('id')} ${buildAutoIncrement(adapter)},
        ${this.quoteIdentifier('username')} VARCHAR(255) NOT NULL UNIQUE,
        ${this.quoteIdentifier('email')} VARCHAR(255) NOT NULL UNIQUE,
        ${this.quoteIdentifier('password_hash')} VARCHAR(255) NOT NULL,
        ${roleColWithDefault},
        ${timestamps.createdAt},
        ${timestamps.updatedAt}
      )${engineClause}
    `)
    
    // Create indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ${this.quoteIdentifier('idx_username')} ON ${usersTable} (${this.quoteIdentifier('username')})
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ${this.quoteIdentifier('idx_email')} ON ${usersTable} (${this.quoteIdentifier('email')})
    `)
    
    // Create update trigger for PostgreSQL
    if (isPostgres) {
      await queryRunner.query(`
        DROP TRIGGER IF EXISTS ${this.quoteIdentifier('update_users_updated_at')} ON ${usersTable};
        CREATE TRIGGER ${this.quoteIdentifier('update_users_updated_at')}
          BEFORE UPDATE ON ${usersTable}
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
      `)
    }

    // Create audit_logs table
    const auditLogsTable = this.quoteIdentifier('audit_logs')
    
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ${auditLogsTable} (
        ${this.quoteIdentifier('id')} ${buildAutoIncrement(adapter)},
        ${this.quoteIdentifier('user_id')} INT NULL,
        ${this.quoteIdentifier('username')} VARCHAR(255) NULL,
        ${this.quoteIdentifier('action')} VARCHAR(255) NOT NULL,
        ${this.quoteIdentifier('resource_type')} VARCHAR(255) NOT NULL,
        ${this.quoteIdentifier('resource_id')} VARCHAR(255) NULL,
        ${this.quoteIdentifier('details')} TEXT NULL,
        ${this.quoteIdentifier('ip_address')} VARCHAR(45) NULL,
        ${this.quoteIdentifier('user_agent')} TEXT NULL,
        ${timestamps.createdAt}
      )${engineClause}
    `)
    
    // Create indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ${this.quoteIdentifier('idx_user_id')} ON ${auditLogsTable} (${this.quoteIdentifier('user_id')})
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ${this.quoteIdentifier('idx_action')} ON ${auditLogsTable} (${this.quoteIdentifier('action')})
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ${this.quoteIdentifier('idx_resource_type')} ON ${auditLogsTable} (${this.quoteIdentifier('resource_type')})
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ${this.quoteIdentifier('idx_created_at')} ON ${auditLogsTable} (${this.quoteIdentifier('created_at')})
    `)
    
    // Create foreign key
    await queryRunner.query(`
      ALTER TABLE ${auditLogsTable}
      ADD CONSTRAINT ${this.quoteIdentifier('fk_audit_logs_user_id')}
      FOREIGN KEY (${this.quoteIdentifier('user_id')})
      REFERENCES ${usersTable}(${this.quoteIdentifier('id')})
      ON DELETE SET NULL
    `)

    // Create rate_limit_logs table
    const rateLimitLogsTable = this.quoteIdentifier('rate_limit_logs')
    
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ${rateLimitLogsTable} (
        ${this.quoteIdentifier('id')} ${buildAutoIncrement(adapter)},
        ${this.quoteIdentifier('ip_address')} VARCHAR(45) NOT NULL,
        ${this.quoteIdentifier('endpoint')} VARCHAR(255) NOT NULL,
        ${this.quoteIdentifier('blocked_at')} TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )${engineClause}
    `)
    
    // Create indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ${this.quoteIdentifier('idx_ip_endpoint')}
      ON ${rateLimitLogsTable} (${this.quoteIdentifier('ip_address')}, ${this.quoteIdentifier('endpoint')})
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ${this.quoteIdentifier('idx_blocked_at')}
      ON ${rateLimitLogsTable} (${this.quoteIdentifier('blocked_at')})
    `)

    // Create pending_user_requests table
    const pendingUserRequestsTable = this.quoteIdentifier('pending_user_requests')
    const requestedRoleCol = buildEnumColumn(adapter, 'requested_role', ['admin', 'user'], false)
    const statusCol = buildEnumColumn(adapter, 'status', ['pending', 'approved', 'rejected'], false)
    const approvedRoleCol = buildEnumColumn(adapter, 'approved_role', ['superadmin', 'admin', 'user'], true)
    const defaultStatus = "DEFAULT 'pending'"
    // Add DEFAULT to status column
    const statusColWithDefault = statusCol.replace('NOT NULL', `NOT NULL ${defaultStatus}`)
    
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ${pendingUserRequestsTable} (
        ${this.quoteIdentifier('id')} ${buildAutoIncrement(adapter)},
        ${this.quoteIdentifier('username')} VARCHAR(255) NOT NULL UNIQUE,
        ${this.quoteIdentifier('email')} VARCHAR(255) NOT NULL UNIQUE,
        ${this.quoteIdentifier('password_hash')} VARCHAR(255) NOT NULL,
        ${requestedRoleCol},
        ${this.quoteIdentifier('requested_by')} INT NULL,
        ${statusColWithDefault},
        ${approvedRoleCol},
        ${this.quoteIdentifier('approved_by')} INT NULL,
        ${this.quoteIdentifier('rejected_by')} INT NULL,
        ${this.quoteIdentifier('rejection_reason')} TEXT NULL,
        ${timestamps.createdAt},
        ${timestamps.updatedAt}
      )${engineClause}
    `)
    
    // Create indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ${this.quoteIdentifier('idx_username')} ON ${pendingUserRequestsTable} (${this.quoteIdentifier('username')})
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ${this.quoteIdentifier('idx_email')} ON ${pendingUserRequestsTable} (${this.quoteIdentifier('email')})
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ${this.quoteIdentifier('idx_status')} ON ${pendingUserRequestsTable} (${this.quoteIdentifier('status')})
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ${this.quoteIdentifier('idx_requested_by')} ON ${pendingUserRequestsTable} (${this.quoteIdentifier('requested_by')})
    `)
    
    // Create foreign keys
    await queryRunner.query(`
      ALTER TABLE ${pendingUserRequestsTable}
      ADD CONSTRAINT ${this.quoteIdentifier('fk_pending_user_requests_requested_by')}
      FOREIGN KEY (${this.quoteIdentifier('requested_by')})
      REFERENCES ${usersTable}(${this.quoteIdentifier('id')})
      ON DELETE SET NULL
    `)
    await queryRunner.query(`
      ALTER TABLE ${pendingUserRequestsTable}
      ADD CONSTRAINT ${this.quoteIdentifier('fk_pending_user_requests_approved_by')}
      FOREIGN KEY (${this.quoteIdentifier('approved_by')})
      REFERENCES ${usersTable}(${this.quoteIdentifier('id')})
      ON DELETE SET NULL
    `)
    await queryRunner.query(`
      ALTER TABLE ${pendingUserRequestsTable}
      ADD CONSTRAINT ${this.quoteIdentifier('fk_pending_user_requests_rejected_by')}
      FOREIGN KEY (${this.quoteIdentifier('rejected_by')})
      REFERENCES ${usersTable}(${this.quoteIdentifier('id')})
      ON DELETE SET NULL
    `)
    
    // Create update trigger for PostgreSQL
    if (isPostgres) {
      await queryRunner.query(`
        DROP TRIGGER IF EXISTS ${this.quoteIdentifier('update_pending_user_requests_updated_at')} ON ${pendingUserRequestsTable};
        CREATE TRIGGER ${this.quoteIdentifier('update_pending_user_requests_updated_at')}
          BEFORE UPDATE ON ${pendingUserRequestsTable}
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
      `)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const adapter = this.getAdapter()
    
    // Drop tables in reverse order (respecting foreign keys)
    await queryRunner.query(buildDropTableQuery(adapter, 'pending_user_requests', true))
    await queryRunner.query(buildDropTableQuery(adapter, 'rate_limit_logs', true))
    await queryRunner.query(buildDropTableQuery(adapter, 'audit_logs', true))
    await queryRunner.query(buildDropTableQuery(adapter, 'users', true))
    await queryRunner.query(buildDropTableQuery(adapter, 'unmapped_rc', true))
    await queryRunner.query(buildDropTableQuery(adapter, 'response_code_dictionary', true))
    await queryRunner.query(buildDropTableQuery(adapter, 'app_success_rate', true))
    await queryRunner.query(buildDropTableQuery(adapter, 'app_identifier', true))
    
    // Drop trigger function for PostgreSQL
    if (adapter.getDatabaseType() === 'postgresql') {
      await queryRunner.query(`DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE`)
    }
  }
}
