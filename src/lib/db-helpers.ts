import { getDb } from './db'

/**
 * Database Helper Functions
 * Utility functions for common database operations
 */

/**
 * Get last insert ID from result
 * Works with both MySQL and PostgreSQL
 */
export function getInsertId(result: any): number {
  return getDb().getLastInsertId(result)
}

/**
 * Normalize error for database-agnostic handling
 */
export function normalizeDbError(error: any): { code: string; message: string } {
  return getDb().normalizeError(error)
}

/**
 * Check if error is duplicate entry
 */
export function isDuplicateEntryError(error: any): boolean {
  const normalized = getDb().normalizeError(error)
  return normalized.code === 'DUPLICATE_ENTRY'
}
