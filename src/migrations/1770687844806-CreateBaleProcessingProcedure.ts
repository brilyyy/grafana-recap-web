import { MigrationInterface, QueryRunner } from 'typeorm'
import { getDatabaseAdapter } from '../lib/db-factory'
import {
  buildAutoIncrement,
  buildEnumColumn,
  buildTimestampColumns,
  buildCreateIndexQuery,
  buildCheckIndexExistsQuery,
} from '../lib/sql-helpers'

export class CreateBaleProcessingProcedure1770687844806 implements MigrationInterface {
  name = 'CreateBaleProcessingProcedure1770687844806'

  private getAdapter() {
    return getDatabaseAdapter()
  }

  private quoteIdentifier(name: string): string {
    return this.getAdapter().quoteIdentifier(name)
  }

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
      const query = buildCreateIndexQuery(adapter, indexName, tableName, columns, unique)
      await queryRunner.query(query)
    } else {
      // MySQL: Check if index exists, if not create it
      const checkQuery = buildCheckIndexExistsQuery(adapter, indexName, tableName)
      
      try {
        const [result]: any = await queryRunner.query(checkQuery, [tableName, indexName])
        const indexExists = result[0]?.count > 0
        
        if (!indexExists) {
          const createQuery = buildCreateIndexQuery(adapter, indexName, tableName, columns, unique)
          try {
            await queryRunner.query(createQuery)
          } catch (createError: any) {
            // If duplicate key error, index already exists - that's okay
            if (createError.code === 'ER_DUP_KEYNAME' || createError.errno === 1061) {
              // Index already exists, that's fine
            } else {
              throw createError
            }
          }
        }
      } catch (error: any) {
        // If check query fails, try to create and catch duplicate error
        try {
          const createQuery = buildCreateIndexQuery(adapter, indexName, tableName, columns, unique)
          await queryRunner.query(createQuery)
        } catch (createError: any) {
          // If duplicate key error, index already exists - that's okay
          if (createError.code === 'ER_DUP_KEYNAME' || createError.errno === 1061) {
            // Index already exists, that's fine
          } else {
            throw createError
          }
        }
      }
    }
  }

  private async checkPgAgentAvailable(queryRunner: QueryRunner): Promise<boolean> {
    try {
      const [result]: any = await queryRunner.query(`
        SELECT EXISTS(
          SELECT 1 FROM information_schema.schemata WHERE schema_name = 'pgagent'
        ) AS exists
      `)
      return result && result[0]?.exists === true
    } catch (error) {
      return false
    }
  }

  /**
   * Get cron schedule from environment variable or use default
   * Default: '1 0 * * *' (00:01 every day)
   * Format: minute hour day month dayOfWeek
   */
  private getCronSchedule(): string {
    return process.env.BALE_PROCESSING_SCHEDULE || '1 0 * * *'
  }

  /**
   * Parse cron schedule for pgAgent
   * Converts cron format to pgAgent schedule arrays
   * Returns: { minutes: number[], hours: number[], weekdays: number[], monthdays: number[], months: number[] }
   */
  private parseCronForPgAgent(cronSchedule: string): {
    minutes: number[]
    hours: number[]
    weekdays: number[]
    monthdays: number[]
    months: number[]
  } {
    const parts = cronSchedule.trim().split(/\s+/)
    if (parts.length !== 5) {
      // Invalid format, use default
      return {
        minutes: [1],
        hours: [0],
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        monthdays: [],
        months: []
      }
    }

    const parseField = (field: string, min: number, max: number): number[] => {
      if (field === '*') {
        return [] // Empty array means all
      }
      
      // Handle ranges and lists
      if (field.includes(',')) {
        return field.split(',').map(v => parseInt(v.trim())).filter(v => v >= min && v <= max)
      }
      
      if (field.includes('-')) {
        const [start, end] = field.split('-').map(v => parseInt(v.trim()))
        const result: number[] = []
        for (let i = start; i <= end; i++) {
          if (i >= min && i <= max) result.push(i)
        }
        return result
      }
      
      // Handle step values like */6
      if (field.includes('/')) {
        const [base, step] = field.split('/')
        const stepNum = parseInt(step)
        const result: number[] = []
        for (let i = min; i <= max; i += stepNum) {
          result.push(i)
        }
        return result
      }
      
      const value = parseInt(field)
      if (value >= min && value <= max) {
        return [value]
      }
      
      return []
    }

    return {
      minutes: parseField(parts[0], 0, 59),
      hours: parseField(parts[1], 0, 23),
      monthdays: parseField(parts[2], 1, 31),
      months: parseField(parts[3], 1, 12),
      weekdays: parseField(parts[4], 0, 6)
    }
  }

  /**
   * Parse cron schedule for MySQL EVENT
   * Converts cron format to MySQL EVENT syntax
   * Returns MySQL EVENT schedule string
   */
  private parseCronForMySQL(cronSchedule: string): string {
    const parts = cronSchedule.trim().split(/\s+/)
    if (parts.length !== 5) {
      // Invalid format, use default: daily at 00:01
      return `EVERY 1 DAY STARTS DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 1 DAY), '%Y-%m-%d 00:01:00')`
    }

    const minute = parts[0] === '*' ? '0' : parts[0]
    const hour = parts[1] === '*' ? '0' : parts[1]
    const isDaily = parts[2] === '*' && parts[3] === '*' && parts[4] === '*'
    
    if (isDaily) {
      return `EVERY 1 DAY STARTS DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 1 DAY), '%Y-%m-%d ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:00')`
    } else {
      return `EVERY 1 DAY STARTS DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 1 DAY), '%Y-%m-%d ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:00')`
    }
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const adapter = this.getAdapter()
    const isPostgres = adapter.getDatabaseType() === 'postgresql'
    const timestamps = buildTimestampColumns(adapter)
    const engineClause = isPostgres ? '' : ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    
    // 1. Create app_processing_log table (generic for all applications)
    const processingLogTable = this.quoteIdentifier('app_processing_log')
    const statusEnumCol = buildEnumColumn(adapter, 'status', ['running', 'success', 'failed'], false)
    
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ${processingLogTable} (
        ${this.quoteIdentifier('id')} ${buildAutoIncrement(adapter)},
        ${this.quoteIdentifier('app_name')} VARCHAR(255) NOT NULL,
        ${this.quoteIdentifier('id_app_identifier')} INT NOT NULL,
        ${this.quoteIdentifier('processing_date')} DATE NOT NULL,
        ${this.quoteIdentifier('start_time')} TIMESTAMP NOT NULL,
        ${this.quoteIdentifier('end_time')} TIMESTAMP NULL,
        ${statusEnumCol},
        ${this.quoteIdentifier('records_processed')} INT DEFAULT 0,
        ${this.quoteIdentifier('records_inserted')} INT DEFAULT 0,
        ${this.quoteIdentifier('records_skipped')} INT DEFAULT 0,
        ${this.quoteIdentifier('error_message')} TEXT NULL,
        ${timestamps.createdAt}
      )${engineClause}
    `)
    
    // Create indexes
    await this.createIndexSafely(queryRunner, 'idx_app_processing_date', 'app_processing_log', ['app_name', 'processing_date'])
    await this.createIndexSafely(queryRunner, 'idx_status', 'app_processing_log', ['status', 'created_at'])
    
    // Create foreign key to app_identifier (only if it doesn't exist)
    const appIdentifierTable = this.quoteIdentifier('app_identifier')
    const fkName = this.quoteIdentifier('fk_app_processing_log_id_app_identifier')
    
    try {
      await queryRunner.query(`
        ALTER TABLE ${processingLogTable}
        ADD CONSTRAINT ${fkName}
        FOREIGN KEY (${this.quoteIdentifier('id_app_identifier')})
        REFERENCES ${appIdentifierTable}(${this.quoteIdentifier('id')})
        ON DELETE CASCADE
      `)
    } catch (error: any) {
      // Check error message for "Duplicate key" as well
      const isDuplicateError = 
        error.code === 'ER_DUP_KEY' || 
        error.code === 'ER_DUP_KEYNAME' || 
        error.code === 'ER_CANT_CREATE_TABLE' || 
        error.errno === 1022 || 
        error.errno === 1061 || 
        error.errno === 1005 ||
        (error.sqlMessage && (
          error.sqlMessage.includes('Duplicate key') ||
          error.sqlMessage.includes('Duplicate foreign key') ||
          error.sqlMessage.includes('already exists')
        ))
      
      if (!isDuplicateError) {
        throw error
      }
      // Foreign key already exists, that's fine
    }
    
    // Note: No trigger needed for app_processing_log as it doesn't have updated_at column
    // The table only has created_at for logging purposes

    // 2. Create stored procedure
    if (isPostgres) {
      await this.createPostgreSQLProcedure(queryRunner)
    } else {
      await this.createMySQLProcedure(queryRunner)
    }

    if (isPostgres) {
      const useAppLevelScheduler = process.env.USE_APP_LEVEL_SCHEDULER === 'true'
      
      if (useAppLevelScheduler) {
        console.log('ℹ️  Using application-level scheduler (node-cron)')
        console.log('   Skipping database scheduler setup for PostgreSQL')
        console.log('   Scheduler will be initialized when application starts')
        return
      }
      
      const [pgCronCheck]: any = await queryRunner.query(`
        SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') AS exists
      `)
      
      if (pgCronCheck && pgCronCheck[0]?.exists) {
        try {
          const cronSchedule = this.getCronSchedule()
          const escapedSchedule = cronSchedule.replace(/'/g, "''")
          await queryRunner.query(`
            SELECT cron.schedule(
              'process-bale-daily',
              '${escapedSchedule}',  -- Schedule from BALE_PROCESSING_SCHEDULE env var
              $$SELECT sp_process_bale_daily(NULL)$$
            );
          `)
          console.log(`✅ pg_cron job created successfully with schedule: ${cronSchedule}`)
        } catch (error: any) {
          console.warn('⚠️  Failed to create pg_cron job. Trying pgAgent...')
          // Fallback to pgAgent
          const pgAgentAvailable = await this.checkPgAgentAvailable(queryRunner)
          if (pgAgentAvailable) {
            await this.createPgAgentJob(queryRunner)
          } else {
            console.warn('⚠️  pgAgent not available. Please setup external cron job manually.')
            console.warn('   Run: SELECT sp_process_bale_daily(NULL); at 00:01 daily')
          }
        }
      } else {
        console.log('ℹ️  pg_cron not available, checking pgAgent...')
        const pgAgentAvailable = await this.checkPgAgentAvailable(queryRunner)
        if (pgAgentAvailable) {
          await this.createPgAgentJob(queryRunner)
        } else {
          console.warn('⚠️  Neither pg_cron nor pgAgent available. Please setup external cron job manually.')
          console.warn('   Run: SELECT sp_process_bale_daily(NULL); at 00:01 daily')
        }
      }
    } else {
      await queryRunner.query(`SET GLOBAL event_scheduler = ON;`)
      
      // Get schedule from environment variable
      const cronSchedule = this.getCronSchedule()
      const mysqlSchedule = this.parseCronForMySQL(cronSchedule)
      
      await queryRunner.query(`
        CREATE EVENT IF NOT EXISTS ${this.quoteIdentifier('evt_process_bale_daily')}
        ON SCHEDULE ${mysqlSchedule}
        DO
          CALL sp_process_bale_daily(NULL);
      `)
      
      console.log(`✅ MySQL event created successfully with schedule: ${cronSchedule}`)
    }
  }

  private async createMySQLProcedure(queryRunner: QueryRunner): Promise<void> {
    // First, drop the procedure separately
    try {
      await queryRunner.query('DROP PROCEDURE IF EXISTS sp_process_bale_daily')
    } catch (error: any) {
      // Ignore error if procedure doesn't exist
    }
    
    const procedureSQL = `
CREATE PROCEDURE sp_process_bale_daily(IN p_processing_date DATE)
MODIFIES SQL DATA
SQL SECURITY DEFINER
BEGIN
  DECLARE v_app_id INT;
  DECLARE v_app_name VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'Bale';
  DECLARE v_start_timestamp DATETIME;
  DECLARE v_end_timestamp DATETIME;
  DECLARE v_processing_date DATE;
  DECLARE v_log_id INT;
  DECLARE v_error_msg TEXT;
  DECLARE v_records_processed INT DEFAULT 0;
  DECLARE v_records_inserted INT DEFAULT 0;
  DECLARE v_done INT DEFAULT 0;
  
  -- Cursor variables
  DECLARE v_tanggal_transaksi DATE;
  DECLARE v_jenis_transaksi VARCHAR(255);
  DECLARE v_rc VARCHAR(50);
  DECLARE v_rc_description VARCHAR(500);
  DECLARE v_total_transaksi INT;
  DECLARE v_total_nominal DECIMAL(20,2);
  DECLARE v_total_biaya_admin DECIMAL(20,2);
  DECLARE v_status_transaksi VARCHAR(255);
  DECLARE v_bulan VARCHAR(20);
  DECLARE v_tahun INT;
  DECLARE v_error_type VARCHAR(255);
  DECLARE v_normalized_rc VARCHAR(50);
  DECLARE v_normalized_rc_desc VARCHAR(500);
  DECLARE v_normalized_status VARCHAR(255);
  DECLARE v_is_rc_empty BOOLEAN;
  DECLARE v_is_success BOOLEAN;
  
  -- Cursor declaration must come before handlers in MySQL
  DECLARE cur_bale_data CURSOR FOR
    WITH categories AS (
        SELECT 'ACTIVATE_DORMANT' COLLATE utf8mb4_unicode_ci AS category UNION ALL
        SELECT 'BILLPAYMENT_BANK_LOAN' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'BILLPAYMENT_BPJS_KESEHATAN' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'BILLPAYMENT_BPJS_TENAGA_KERJA' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'BILLPAYMENT_CREDIT_CARD' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'BILLPAYMENT_CREDIT_CARD_OrbER' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'BILLPAYMENT_DONATION_ACT' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'BILLPAYMENT_DONATION_BAZNAS' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'BILLPAYMENT_DONATION_DOMPET' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'BILLPAYMENT_ECOM_BUKALAPAK' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'BILLPAYMENT_ECOM_TOKOPEDIA' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'BILLPAYMENT_EDUCATION' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'BILLPAYMENT_INSURANCE' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'BILLPAYMENT_INTERNET_TV' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'BILLPAYMENT_MPN' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'BILLPAYMENT_MULTIBILLER' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'BILLPAYMENT_MULTIBILLER_LEGAL' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'BILLPAYMENT_NON_PBB' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'BILLPAYMENT_OrbER_LOAN' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'BILLPAYMENT_PBB' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'BILLPAYMENT_PDAM' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'BILLPAYMENT_PEGADAIAN' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'BILLPAYMENT_PGN' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'BILLPAYMENT_PHONE' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'BILLPAYMENT_PLN' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'BILLPAYMENT_TICKET_TRAIN' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'BILLPAYMENT_TRANSPORTATION' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'BILLPAYMENT_VA' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'BILLPAYMENT_VA_MORTGAGE' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'BILLPAYMENT_VEHICLE_TAX' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'BUY_MUTUAL_FUND' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'BUY_SBN' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'CARDLESS_DEPOSIT' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'CARDLESS_WIrbDRAWAL' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'EDEPOSITO_PLACEMENT' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'EDEPOSITO_WIrbDRAWAL' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'FREEZE_PROXY_BIFAST' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'MONEY_CHANGER' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'PORTING_PROXY_BIFAST' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'PURCHASE_EVOUCHER_MTIX' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'PURCHASE_EVOUCHER_STREAMING' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'PURCHASE_NFC_EMONEY' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'PURCHASE_NFC_FLAZZ' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'PURCHASE_NFC_TAPCASH' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'PURCHASE_PHONE' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'PURCHASE_PLN_PREPAID' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'PURCHASE_TOPUP_DANA' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'PURCHASE_TOPUP_GOPAY' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'PURCHASE_TOPUP_ISAKU' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'PURCHASE_TOPUP_LINKAJA' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'PURCHASE_TOPUP_OVO' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'PURCHASE_TOPUP_POSPAY' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'PURCHASE_TOPUP_SHOPEEPAY' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'QR_CROSS_BORDER' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'QR_MPM' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'REGISTRATION_PROXY_BIFAST' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'SELL_MUTUAL_FUND' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'SWITCH_FROM_MUTUAL_FUND' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'SWITCH_TO_MUTUAL_FUND' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'TRANSFER_ALL' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'TRANSFER_BIFAST' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'TRANSFER_FOREX_OA' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'TRANSFER_FOREX_ON_US' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'TRANSFER_OA' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'TRANSFER_OFF_US' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'TRANSFER_ON_US' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'TRANSFER_RTGS' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'TRANSFER_SKN' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'TRANSFER_SPLIT_BILL' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'TRANSFER_SWIFT' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'UNFREEZE_PROXY_BIFAST' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'UNREGISTRATION_PROXY_BIFAST' COLLATE utf8mb4_unicode_ci UNION ALL
        SELECT 'UPDATE_PROXY_BIFAST' COLLATE utf8mb4_unicode_ci
    )
    SELECT 
        DATE_FORMAT(rb.transaction_date, '%Y-%m-%d') AS \`Tanggal Transaksi\`,
        rb.transaction_category AS \`Jenis Transaksi\`,
        rb.result_code AS \`RC\`,
        rb.result_code_desc AS \`RC Description\`,
        COUNT(DISTINCT rb.id) AS \`total transaksi\`,
        SUM(rb.transaction_amount) AS \`Total Nominal\`,
        SUM(rb.transaction_fee) AS \`Total Biaya Admin\`,
        CASE  
            WHEN rb.transaction_status = 0 THEN 'Success' 
            WHEN rb.transaction_status = 1 THEN 'Failed' 
            WHEN rb.transaction_status = 2 THEN 'Pending' 
            WHEN rb.transaction_status = 9 THEN 'ACK' 
            WHEN rb.transaction_status = 8 THEN 'REVERSAL' 
            ELSE 'Status Tidak Dikenal' 
        END AS \`Status Transaksi\`
    FROM raw_bale rb
    JOIN categories c 
        ON rb.transaction_category COLLATE utf8mb4_unicode_ci = c.category COLLATE utf8mb4_unicode_ci
    WHERE 
        rb.transaction_state IN ('1','9','8')
        AND rb.transaction_date BETWEEN v_start_timestamp AND v_end_timestamp
    GROUP BY 
        \`Tanggal Transaksi\`,
        rb.transaction_category,
        rb.result_code,
        rb.result_code_desc,
        rb.transaction_status
    ORDER BY 
        \`Tanggal Transaksi\` DESC;

  -- Handlers must be declared after cursor in MySQL
  -- Note: CONTINUE HANDLER FOR NOT FOUND will be triggered by FETCH and SELECT...INTO
  -- We need to reset v_done after SELECT...INTO to prevent premature loop exit
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = 1;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    -- Try to rollback if in transaction, but don't fail if not
    BEGIN
      ROLLBACK;
    END;
    
    GET DIAGNOSTICS CONDITION 1
      v_error_msg = MESSAGE_TEXT;
    
    -- Only update log if log_id exists
    IF v_log_id IS NOT NULL THEN
      BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION BEGIN END;
        UPDATE app_processing_log
        SET status = 'failed',
            end_time = NOW(),
            error_message = CONCAT(COALESCE(error_message, ''), ' | ', COALESCE(v_error_msg, 'UNKNOWN'))
        WHERE id = v_log_id;
      END;
    END IF;
    
    -- Re-raise the error so caller knows something went wrong
    RESIGNAL;
  END;

  -- Determine processing date: if parameter is NULL, use H-1 (yesterday), otherwise use provided date
  IF p_processing_date IS NULL THEN
    SET v_processing_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY);
  ELSE
    SET v_processing_date = p_processing_date;
  END IF;
  
  -- Calculate timestamps for processing_date (00:00:00 to 23:59:59)
  SET v_start_timestamp = v_processing_date;
  SET v_end_timestamp = DATE_ADD(v_processing_date, INTERVAL 1 DAY) - INTERVAL 1 SECOND;

  -- Lookup app_identifier for 'Bale'
  SELECT id INTO v_app_id
  FROM app_identifier
  WHERE app_name COLLATE utf8mb4_unicode_ci = v_app_name COLLATE utf8mb4_unicode_ci
  LIMIT 1;

  IF v_app_id IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Application Bale not found in app_identifier table';
  END IF;

  -- Insert log entry - OUTSIDE TRANSACTION so it persists even if transaction fails
  INSERT INTO app_processing_log (app_name, id_app_identifier, processing_date, start_time, status)
  VALUES (v_app_name, v_app_id, v_processing_date, NOW(), 'running');
  
  SET v_log_id = LAST_INSERT_ID();

  -- Verify log entry was created
  IF v_log_id IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Failed to create processing log entry';
  END IF;

  -- Start transaction
  START TRANSACTION;

  -- Delete existing data for processing_date (replace strategy)
  DELETE FROM app_success_rate
  WHERE id_app_identifier = v_app_id
    AND tanggal_transaksi = v_processing_date;

  -- Reset done flag before opening cursor
  SET v_done = 0;

  -- Open cursor and process rows
  OPEN cur_bale_data;
  
  read_loop: LOOP
    FETCH cur_bale_data INTO
      v_tanggal_transaksi,
      v_jenis_transaksi,
      v_rc,
      v_rc_description,
      v_total_transaksi,
      v_total_nominal,
      v_total_biaya_admin,
      v_status_transaksi;
    
    IF v_done THEN
      LEAVE read_loop;
    END IF;

    SET v_records_processed = v_records_processed + 1;

    -- Extract bulan and tahun from tanggal_transaksi
    SET v_bulan = MONTH(v_tanggal_transaksi);
    SET v_tahun = YEAR(v_tanggal_transaksi);

    -- Normalize RC: handle NULL, empty string, or '-'
    SET v_normalized_rc = NULLIF(TRIM(COALESCE(v_rc, '')), '');
    SET v_normalized_rc = NULLIF(v_normalized_rc, '-');
    SET v_is_rc_empty = (v_normalized_rc IS NULL OR v_normalized_rc = '' OR v_normalized_rc = '-');
    
    SET v_normalized_rc_desc = LOWER(TRIM(COALESCE(v_rc_description, '')));
    SET v_normalized_status = LOWER(TRIM(COALESCE(v_status_transaksi, '')));
    
    -- Check if success indicators exist
    SET v_is_success = (
      v_normalized_rc_desc IN ('sukses', 'success', 'berhasil') OR
      v_normalized_status IN ('sukses', 'success', 'berhasil')
    );

    -- Business rule: If RC is empty/null/'-' and success indicator exists, set RC='00'
    IF v_is_rc_empty AND v_is_success THEN
      SET v_normalized_rc = '00';
      SET v_is_rc_empty = FALSE;
    END IF;

    -- Lookup error_type from response_code_dictionary
    SET v_error_type = NULL;
    
    IF NOT v_is_rc_empty AND v_jenis_transaksi IS NOT NULL THEN
      -- Reset v_done before SELECT...INTO to prevent handler from affecting cursor loop
      SET v_done = 0;
      
      SELECT error_type INTO v_error_type
      FROM response_code_dictionary
      WHERE id_app_identifier = v_app_id
        AND jenis_transaksi COLLATE utf8mb4_unicode_ci = v_jenis_transaksi COLLATE utf8mb4_unicode_ci
        AND rc COLLATE utf8mb4_unicode_ci = v_normalized_rc COLLATE utf8mb4_unicode_ci
      LIMIT 1;
      
      -- Reset v_done after SELECT...INTO (it may have been set to 1 by handler if no row found)
      SET v_done = 0;

      -- If not found, insert into unmapped_rc
      IF v_error_type IS NULL THEN
        INSERT IGNORE INTO unmapped_rc
          (id_app_identifier, jenis_transaksi, rc, rc_description, status_transaksi, error_type)
        VALUES
          (v_app_id, v_jenis_transaksi, v_normalized_rc, v_rc_description, v_status_transaksi, NULL);
      END IF;
    END IF;

    -- Handle RC empty with success indicator
    IF v_is_rc_empty THEN
      IF v_is_success THEN
        SET v_normalized_rc = '00';
        SET v_error_type = 'Sukses';
      ELSE
        SET v_error_type = NULL; -- No RC Transaction
      END IF;
    END IF;

    -- Insert into app_success_rate
    INSERT INTO app_success_rate (
      id_app_identifier,
      tanggal_transaksi,
      bulan,
      tahun,
      jenis_transaksi,
      rc,
      rc_description,
      total_transaksi,
      total_nominal,
      total_biaya_admin,
      status_transaksi,
      error_type
    ) VALUES (
      v_app_id,
      v_tanggal_transaksi,
      v_bulan,
      v_tahun,
      v_jenis_transaksi,
      v_normalized_rc,
      v_rc_description,
      v_total_transaksi,
      v_total_nominal,
      v_total_biaya_admin,
      v_status_transaksi,
      v_error_type
    );

    SET v_records_inserted = v_records_inserted + 1;
  END LOOP;

  CLOSE cur_bale_data;

  -- Commit transaction
  COMMIT;

  -- Update log entry
  UPDATE app_processing_log
  SET status = 'success',
      end_time = NOW(),
      records_processed = v_records_processed,
      records_inserted = v_records_inserted
  WHERE id = v_log_id;
    END;
    `
    
    // Execute procedure creation
    await queryRunner.query(procedureSQL)
  }

  private async createPostgreSQLProcedure(queryRunner: QueryRunner): Promise<void> {
    // Create stored procedure (PostgreSQL function) with embedded query
    // Note: Query is embedded directly from db/postgres/success-rate-queries/bale/bale.postgres.sql
    const procedureSQL = `
CREATE OR REPLACE FUNCTION sp_process_bale_daily(p_processing_date DATE DEFAULT NULL)
RETURNS void AS $$
DECLARE
  v_app_id INT;
  v_app_name VARCHAR(255) := 'Bale';
  v_start_timestamp TIMESTAMP;
  v_end_timestamp TIMESTAMP;
  v_processing_date DATE;
  v_log_id INT;
  v_error_msg TEXT;
  v_records_processed INT := 0;
  v_records_inserted INT := 0;
  rec RECORD;
  v_tanggal_transaksi DATE;
  v_jenis_transaksi VARCHAR(255);
  v_rc VARCHAR(50);
  v_rc_description VARCHAR(500);
  v_total_transaksi INT;
  v_total_nominal DECIMAL(20,2);
  v_total_biaya_admin DECIMAL(20,2);
  v_status_transaksi VARCHAR(255);
  v_bulan VARCHAR(20);
  v_tahun INT;
  v_error_type VARCHAR(255);
  v_normalized_rc VARCHAR(50);
  v_normalized_rc_desc VARCHAR(500);
  v_normalized_status VARCHAR(255);
  v_is_rc_empty BOOLEAN;
  v_is_success BOOLEAN;
BEGIN
  -- Determine processing date: if parameter is NULL, use H-1 (yesterday), otherwise use provided date
  IF p_processing_date IS NULL THEN
    v_processing_date := CURRENT_DATE - INTERVAL '1 day';
  ELSE
    v_processing_date := p_processing_date;
  END IF;
  
  -- Calculate timestamps for processing_date (00:00:00 to 23:59:59)
  v_start_timestamp := v_processing_date::timestamp;
  v_end_timestamp := (v_processing_date + INTERVAL '1 day' - INTERVAL '1 second')::timestamp;

  -- Lookup app_identifier for 'Bale'
  SELECT id INTO v_app_id
  FROM app_identifier
  WHERE app_name = v_app_name
  LIMIT 1;

  IF v_app_id IS NULL THEN
    RAISE EXCEPTION 'Application Bale not found in app_identifier table';
  END IF;

  -- Insert log entry
  INSERT INTO app_processing_log (app_name, id_app_identifier, processing_date, start_time, status)
  VALUES (v_app_name, v_app_id, v_processing_date, NOW(), 'running')
  RETURNING id INTO v_log_id;

  -- Start transaction (implicit in function)
  BEGIN
    -- Delete existing data for processing_date (replace strategy)
    DELETE FROM app_success_rate
    WHERE id_app_identifier = v_app_id
      AND tanggal_transaksi = v_processing_date;

    -- Process rows from query (embedded from db/postgres/success-rate-queries/bale/bale.postgres.sql)
    FOR rec IN 
      WITH categories AS ( 
          SELECT unnest(ARRAY[ 
              'ACTIVATE_DORMANT', 'BILLPAYMENT_BANK_LOAN', 'BILLPAYMENT_BPJS_KESEHATAN', 'BILLPAYMENT_BPJS_TENAGA_KERJA', 
              'BILLPAYMENT_CREDIT_CARD', 'BILLPAYMENT_CREDIT_CARD_OrbER', 'BILLPAYMENT_DONATION_ACT', 
              'BILLPAYMENT_DONATION_BAZNAS', 'BILLPAYMENT_DONATION_DOMPET', 'BILLPAYMENT_ECOM_BUKALAPAK', 
              'BILLPAYMENT_ECOM_TOKOPEDIA', 'BILLPAYMENT_EDUCATION', 'BILLPAYMENT_INSURANCE', 
              'BILLPAYMENT_INTERNET_TV', 'BILLPAYMENT_MPN', 'BILLPAYMENT_MULTIBILLER', 
              'BILLPAYMENT_MULTIBILLER_LEGAL', 'BILLPAYMENT_NON_PBB', 'BILLPAYMENT_OrbER_LOAN', 'BILLPAYMENT_PBB', 
              'BILLPAYMENT_PDAM', 'BILLPAYMENT_PEGADAIAN', 'BILLPAYMENT_PGN', 'BILLPAYMENT_PHONE', 
              'BILLPAYMENT_PLN', 'BILLPAYMENT_TICKET_TRAIN', 'BILLPAYMENT_TRANSPORTATION', 'BILLPAYMENT_VA', 
              'BILLPAYMENT_VA_MORTGAGE', 'BILLPAYMENT_VEHICLE_TAX', 'BUY_MUTUAL_FUND', 'BUY_SBN', 
              'CARDLESS_DEPOSIT', 'CARDLESS_WIrbDRAWAL', 'EDEPOSITO_PLACEMENT', 'EDEPOSITO_WIrbDRAWAL', 
              'FREEZE_PROXY_BIFAST', 'MONEY_CHANGER', 'PORTING_PROXY_BIFAST', 
              'PURCHASE_EVOUCHER_MTIX', 'PURCHASE_EVOUCHER_STREAMING', 'PURCHASE_NFC_EMONEY', 
              'PURCHASE_NFC_FLAZZ', 'PURCHASE_NFC_TAPCASH', 'PURCHASE_PHONE', 'PURCHASE_PLN_PREPAID', 
              'PURCHASE_TOPUP_DANA', 'PURCHASE_TOPUP_GOPAY', 'PURCHASE_TOPUP_ISAKU', 'PURCHASE_TOPUP_LINKAJA', 
              'PURCHASE_TOPUP_OVO', 'PURCHASE_TOPUP_POSPAY', 'PURCHASE_TOPUP_SHOPEEPAY', 'QR_CROSS_BORDER', 
              'QR_MPM', 'REGISTRATION_PROXY_BIFAST', 'SELL_MUTUAL_FUND', 'SWITCH_FROM_MUTUAL_FUND', 
              'SWITCH_TO_MUTUAL_FUND', 'TRANSFER_ALL', 'TRANSFER_BIFAST', 'TRANSFER_FOREX_OA', 
              'TRANSFER_FOREX_ON_US', 'TRANSFER_OA', 'TRANSFER_OFF_US', 'TRANSFER_ON_US', 'TRANSFER_RTGS', 
              'TRANSFER_SKN', 'TRANSFER_SPLIT_BILL', 'TRANSFER_SWIFT', 'UNFREEZE_PROXY_BIFAST', 
              'UNREGISTRATION_PROXY_BIFAST', 'UPDATE_PROXY_BIFAST' 
          ]) AS category 
      ) 
      SELECT 
          to_char(rb.transaction_date,'YYYY-MM-DD') AS "Tanggal Transaksi", 
          rb.transaction_category AS "Jenis Transaksi", 
          rb.result_code AS "RC", 
          rb.result_code_desc AS "RC Description", 
          count(DISTINCT rb.id) AS "total transaksi", 
          SUM(rb.transaction_amount) AS "Total Nominal", 
          SUM(rb.transaction_fee) AS "Total Biaya Admin", 
          CASE  
              WHEN rb.transaction_status = 0 THEN 'Success' 
              WHEN rb.transaction_status = 1 THEN 'Failed' 
              WHEN rb.transaction_status = 2 THEN 'Pending' 
              WHEN rb.transaction_status = 9 THEN 'ACK' 
              WHEN rb.transaction_status = 8 THEN 'REVERSAL' 
              ELSE 'Status Tidak Dikenal' 
          END AS "Status Transaksi"  
      FROM 
          raw_bale rb 
          JOIN categories c ON rb.transaction_category = c.category 
      WHERE 
          rb.transaction_state IN ('1','9','8') 
          AND rb.transaction_date BETWEEN v_start_timestamp AND v_end_timestamp 
      GROUP BY 
          "Tanggal Transaksi",rb.transaction_category,rb.result_code ,rb.result_code_desc , rb.transaction_status  
      ORDER BY 
          "Tanggal Transaksi" DESC
    LOOP
      v_records_processed := v_records_processed + 1;

      v_tanggal_transaksi := rec."Tanggal Transaksi"::date;
      v_jenis_transaksi := rec."Jenis Transaksi";
      v_rc := rec."RC";
      v_rc_description := rec."RC Description";
      v_total_transaksi := rec."total transaksi";
      v_total_nominal := rec."Total Nominal";
      v_total_biaya_admin := rec."Total Biaya Admin";
      v_status_transaksi := rec."Status Transaksi";

      -- Extract bulan and tahun from tanggal_transaksi
      v_bulan := EXTRACT(MONTH FROM v_tanggal_transaksi)::VARCHAR;
      v_tahun := EXTRACT(YEAR FROM v_tanggal_transaksi);

      -- Normalize RC: handle NULL, empty string, or '-'
      v_normalized_rc := NULLIF(TRIM(COALESCE(v_rc, '')), '');
      v_normalized_rc := NULLIF(v_normalized_rc, '-');
      v_is_rc_empty := (v_normalized_rc IS NULL OR v_normalized_rc = '' OR v_normalized_rc = '-');
      
      v_normalized_rc_desc := LOWER(TRIM(COALESCE(v_rc_description, '')));
      v_normalized_status := LOWER(TRIM(COALESCE(v_status_transaksi, '')));
      
      -- Check if success indicators exist
      v_is_success := (
        v_normalized_rc_desc IN ('sukses', 'success', 'berhasil') OR
        v_normalized_status IN ('sukses', 'success', 'berhasil')
      );

      -- Business rule: If RC is empty/null/'-' and success indicator exists, set RC='00'
      IF v_is_rc_empty AND v_is_success THEN
        v_normalized_rc := '00';
        v_is_rc_empty := FALSE;
      END IF;

      -- Lookup error_type from response_code_dictionary
      v_error_type := NULL;
      
      IF NOT v_is_rc_empty AND v_jenis_transaksi IS NOT NULL THEN
        SELECT error_type INTO v_error_type
        FROM response_code_dictionary
        WHERE id_app_identifier = v_app_id
          AND jenis_transaksi = v_jenis_transaksi
          AND rc = v_normalized_rc
        LIMIT 1;

        -- If not found, insert into unmapped_rc
        IF v_error_type IS NULL THEN
          INSERT INTO unmapped_rc
            (id_app_identifier, jenis_transaksi, rc, rc_description, status_transaksi, error_type)
          VALUES
            (v_app_id, v_jenis_transaksi, v_normalized_rc, v_rc_description, v_status_transaksi, NULL)
          ON CONFLICT (id_app_identifier, jenis_transaksi, rc) DO NOTHING;
        END IF;
      END IF;

      -- Handle RC empty with success indicator
      IF v_is_rc_empty THEN
        IF v_is_success THEN
          v_normalized_rc := '00';
          v_error_type := 'Sukses';
        ELSE
          v_error_type := NULL; -- No RC Transaction
        END IF;
      END IF;

      -- Insert into app_success_rate
      INSERT INTO app_success_rate (
        id_app_identifier,
        tanggal_transaksi,
        bulan,
        tahun,
        jenis_transaksi,
        rc,
        rc_description,
        total_transaksi,
        total_nominal,
        total_biaya_admin,
        status_transaksi,
        error_type
      ) VALUES (
        v_app_id,
        v_tanggal_transaksi,
        v_bulan,
        v_tahun,
        v_jenis_transaksi,
        v_normalized_rc,
        v_rc_description,
        v_total_transaksi,
        v_total_nominal,
        v_total_biaya_admin,
        v_status_transaksi,
        v_error_type
      );

      v_records_inserted := v_records_inserted + 1;
    END LOOP;

    -- Update log entry
    UPDATE app_processing_log
    SET status = 'success',
        end_time = NOW(),
        records_processed = v_records_processed,
        records_inserted = v_records_inserted
    WHERE id = v_log_id;

  EXCEPTION
    WHEN OTHERS THEN
      -- Rollback is automatic in function
      GET STACKED DIAGNOSTICS v_error_msg = MESSAGE_TEXT;
      UPDATE app_processing_log
      SET status = 'failed',
          end_time = NOW(),
          error_message = v_error_msg
      WHERE id = v_log_id;
      RAISE;
  END;
END;
$$ LANGUAGE plpgsql;
    `
    
    await queryRunner.query(procedureSQL)
  }

  private async createPgAgentJob(queryRunner: QueryRunner): Promise<void> {
    try {
      // Check if job already exists
      const [existingJob]: any = await queryRunner.query(`
        SELECT j.jobid 
        FROM pgagent.pga_job j
        WHERE j.jobname = 'process-bale-daily'
        LIMIT 1
      `)
      
      if (existingJob && existingJob.length > 0) {
        console.log('ℹ️  pgAgent job already exists, skipping creation')
        return
      }
      
      const cronSchedule = this.getCronSchedule()
      const schedule = this.parseCronForPgAgent(cronSchedule)
      
      const formatArray = (arr: number[]): string => {
        if (arr.length === 0) return 'ARRAY[]::INTEGER[]'
        return `ARRAY[${arr.join(',')}]`
      }
      
      // Use parsed values, empty array means "all" in pgAgent
      const minutesArray = formatArray(schedule.minutes)
      const hoursArray = formatArray(schedule.hours)
      const weekdaysArray = formatArray(schedule.weekdays)
      const monthdaysArray = formatArray(schedule.monthdays)
      const monthsArray = formatArray(schedule.months)
      
      // Create pgAgent job
      await queryRunner.query(`
        DO $$
        DECLARE
          v_jobid INTEGER;
        BEGIN
          -- Insert job
          INSERT INTO pgagent.pga_job (jobjclid, jobname, jobdesc, jobhostagent, jobenabled)
          VALUES (1, 'process-bale-daily', 'BALE processing (schedule: ${cronSchedule.replace(/'/g, "''")})', '', true)
          RETURNING jobid INTO v_jobid;
          
          -- Insert schedule (from BALE_PROCESSING_SCHEDULE env var)
          INSERT INTO pgagent.pga_schedule (
            jscjobid, jscname, jscdesc, jscenabled,
            jscstart, jscminutes, jschours, jscweekdays, 
            jscmonthdays, jscmonths
          ) VALUES (
            v_jobid, 'bale-daily-schedule', 'BALE processing schedule', true,
            NOW(), -- Start immediately
            ${minutesArray}, -- Minutes from schedule
            ${hoursArray}, -- Hours from schedule
            ${weekdaysArray}, -- Days of week from schedule
            ${monthdaysArray}, -- Days of month from schedule (empty = all)
            ${monthsArray} -- Months from schedule (empty = all)
          );
          
          -- Insert step (the actual SQL to execute)
          INSERT INTO pgagent.pga_jobstep (
            jstjobid, jstname, jstkind, jstcode, jstdbname, jstenabled
          ) VALUES (
            v_jobid, 'execute-procedure', 's', 
            'SELECT sp_process_bale_daily(NULL);',
            current_database(),
            true
          );
        END $$;
      `)
      
      console.log(`✅ pgAgent job created successfully with schedule: ${cronSchedule}`)
    } catch (error: any) {
      console.warn('⚠️  Failed to create pgAgent job:', error.message)
      console.warn('   Please setup external cron job manually.')
      console.warn('   Run: SELECT sp_process_bale_daily(NULL); at 00:01 daily')
    }
  }

  private async removePgAgentJob(queryRunner: QueryRunner): Promise<void> {
    try {
      const isAvailable = await this.checkPgAgentAvailable(queryRunner)
      if (!isAvailable) {
        return
      }
      
      await queryRunner.query(`
        DELETE FROM pgagent.pga_job 
        WHERE jobname = 'process-bale-daily'
      `)
      
      console.log('✅ pgAgent job removed successfully')
    } catch (error: any) {
      // Ignore if job doesn't exist or pgAgent not available
      console.warn('⚠️  Failed to remove pgAgent job:', error.message)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const adapter = this.getAdapter()
    const isPostgres = adapter.getDatabaseType() === 'postgresql'
    
    // Drop event scheduler (MySQL) or scheduler jobs (PostgreSQL: pg_cron or pgAgent)
    if (isPostgres) {
      // Try to remove pg_cron job first
      const [pgCronCheck]: any = await queryRunner.query(`
        SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') AS exists
      `)
      
      if (pgCronCheck && pgCronCheck[0]?.exists) {
        try {
          await queryRunner.query(`SELECT cron.unschedule('process-bale-daily');`)
        } catch (error) {
          // Ignore if job doesn't exist
        }
      }
      
      // Try to remove pgAgent job
      await this.removePgAgentJob(queryRunner)
    } else {
      await queryRunner.query(`DROP EVENT IF EXISTS ${this.quoteIdentifier('evt_process_bale_daily')};`)
    }
    
    // Drop stored procedure
    if (isPostgres) {
      await queryRunner.query(`DROP FUNCTION IF EXISTS sp_process_bale_daily();`)
    } else {
      await queryRunner.query(`DROP PROCEDURE IF EXISTS sp_process_bale_daily;`)
    }
  }
}
