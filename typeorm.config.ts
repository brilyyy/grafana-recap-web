require('reflect-metadata')
const { DataSource } = require('typeorm')
const dotenv = require('dotenv')

// Load environment variables
dotenv.config()

/**
 * TypeORM Configuration for CLI commands (migrations)
 * This file is used by TypeORM CLI tools
 * Using CommonJS style for typeorm-ts-node-commonjs compatibility
 */
module.exports = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  
  // Entities - load all entity files
  entities: [__dirname + '/src/entities/**/*.ts'],
  
  // Migrations - using pattern like example project
  migrations: [__dirname + '/src/migrations/**/*{.ts,.js}'],
  
  // Synchronization (disabled - use migrations only)
  synchronize: false,
  
  // Logging
  logging: true,
  
  // MySQL specific options
  charset: 'utf8mb4',
  timezone: '+00:00',
})
