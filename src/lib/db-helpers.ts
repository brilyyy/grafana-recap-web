import { adapter } from './db'

/**
 * Database Helper Functions
 * Utility functions for common database operations
 */

/**
 * Get last insert ID from result
 * Works with both MySQL and PostgreSQL
 */
export function getInsertId(result: any): number {
  return adapter.getLastInsertId(result)
}

/**
 * Normalize error for database-agnostic handling
 */
export function normalizeDbError(error: any): { code: string; message: string } {
  return adapter.normalizeError(error)
}

/**
 * Check if error is duplicate entry
 */
export function isDuplicateEntryError(error: any): boolean {
  const normalized = normalizeDbError(error)
  return normalized.code === 'DUPLICATE_ENTRY'
}
