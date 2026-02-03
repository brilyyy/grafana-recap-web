import { MigrationInterface, QueryRunner } from 'typeorm'

export class InitialSchema1770030366139 implements MigrationInterface {
  name = 'InitialSchema1770030366139'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create app_identifier table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`app_identifier\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`app_name\` VARCHAR(255) NOT NULL UNIQUE,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_app_name\` (\`app_name\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    // Create app_success_rate table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`app_success_rate\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`id_app_identifier\` INT NOT NULL,
        \`tanggal_transaksi\` DATE NOT NULL,
        \`bulan\` VARCHAR(20) NOT NULL,
        \`tahun\` INT NOT NULL,
        \`jenis_transaksi\` VARCHAR(255) NOT NULL,
        \`rc\` VARCHAR(50) NULL,
        \`rc_description\` VARCHAR(500) NULL,
        \`total_transaksi\` INT NULL,
        \`total_nominal\` DECIMAL(20, 2) NULL,
        \`total_biaya_admin\` DECIMAL(20, 2) NULL,
        \`status_transaksi\` VARCHAR(255) NULL,
        \`error_type\` ENUM('S', 'N', 'Sukses') NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_tanggal_transaksi\` (\`tanggal_transaksi\`),
        INDEX \`idx_id_app_identifier\` (\`id_app_identifier\`),
        FOREIGN KEY (\`id_app_identifier\`) REFERENCES \`app_identifier\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    // Create response_code_dictionary table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`response_code_dictionary\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`id_app_identifier\` INT NOT NULL,
        \`jenis_transaksi\` VARCHAR(255) NULL,
        \`rc\` VARCHAR(50) NULL,
        \`rc_description\` VARCHAR(500) NULL,
        \`error_type\` ENUM('S', 'N', 'Sukses') NOT NULL,
        FOREIGN KEY (\`id_app_identifier\`) REFERENCES \`app_identifier\`(\`id\`) ON DELETE CASCADE,
        UNIQUE KEY \`unique_dictionary_entry\` (\`id_app_identifier\`, \`jenis_transaksi\`, \`rc\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    // Create unmapped_rc table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`unmapped_rc\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`id_app_identifier\` INT NOT NULL,
        \`jenis_transaksi\` VARCHAR(255) NULL,
        \`rc\` VARCHAR(50) NULL,
        \`rc_description\` VARCHAR(500) NULL,
        \`status_transaksi\` VARCHAR(255) NULL,
        \`error_type\` ENUM('S', 'N', 'Sukses') NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (\`id_app_identifier\`) REFERENCES \`app_identifier\`(\`id\`) ON DELETE CASCADE,
        UNIQUE KEY \`unique_unmapped_entry\` (\`id_app_identifier\`, \`jenis_transaksi\`, \`rc\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    // Create users table with superadmin role
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`users\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`username\` VARCHAR(255) NOT NULL UNIQUE,
        \`email\` VARCHAR(255) NOT NULL UNIQUE,
        \`password_hash\` VARCHAR(255) NOT NULL,
        \`role\` ENUM('superadmin', 'admin', 'user') NOT NULL DEFAULT 'user',
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_username\` (\`username\`),
        INDEX \`idx_email\` (\`email\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    // Create audit_logs table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`audit_logs\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`user_id\` INT NULL,
        \`username\` VARCHAR(255) NULL,
        \`action\` VARCHAR(255) NOT NULL,
        \`resource_type\` VARCHAR(255) NOT NULL,
        \`resource_id\` VARCHAR(255) NULL,
        \`details\` TEXT NULL,
        \`ip_address\` VARCHAR(45) NULL,
        \`user_agent\` TEXT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_user_id\` (\`user_id\`),
        INDEX \`idx_action\` (\`action\`),
        INDEX \`idx_resource_type\` (\`resource_type\`),
        INDEX \`idx_created_at\` (\`created_at\`),
        FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    // Create rate_limit_logs table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`rate_limit_logs\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`ip_address\` VARCHAR(45) NOT NULL,
        \`endpoint\` VARCHAR(255) NOT NULL,
        \`blocked_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_ip_endpoint\` (\`ip_address\`, \`endpoint\`),
        INDEX \`idx_blocked_at\` (\`blocked_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    // Create pending_user_requests table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`pending_user_requests\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`username\` VARCHAR(255) NOT NULL UNIQUE,
        \`email\` VARCHAR(255) NOT NULL UNIQUE,
        \`password_hash\` VARCHAR(255) NOT NULL,
        \`requested_role\` ENUM('admin', 'user') NOT NULL,
        \`requested_by\` INT NULL,
        \`status\` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
        \`approved_role\` ENUM('superadmin', 'admin', 'user') NULL,
        \`approved_by\` INT NULL,
        \`rejected_by\` INT NULL,
        \`rejection_reason\` TEXT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_username\` (\`username\`),
        INDEX \`idx_email\` (\`email\`),
        INDEX \`idx_status\` (\`status\`),
        INDEX \`idx_requested_by\` (\`requested_by\`),
        FOREIGN KEY (\`requested_by\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL,
        FOREIGN KEY (\`approved_by\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL,
        FOREIGN KEY (\`rejected_by\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order (respecting foreign keys)
    await queryRunner.query(`DROP TABLE IF EXISTS \`pending_user_requests\``)
    await queryRunner.query(`DROP TABLE IF EXISTS \`rate_limit_logs\``)
    await queryRunner.query(`DROP TABLE IF EXISTS \`audit_logs\``)
    await queryRunner.query(`DROP TABLE IF EXISTS \`users\``)
    await queryRunner.query(`DROP TABLE IF EXISTS \`unmapped_rc\``)
    await queryRunner.query(`DROP TABLE IF EXISTS \`response_code_dictionary\``)
    await queryRunner.query(`DROP TABLE IF EXISTS \`app_success_rate\``)
    await queryRunner.query(`DROP TABLE IF EXISTS \`app_identifier\``)
  }
}
