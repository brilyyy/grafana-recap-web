/** Normalize app_identifier.app_name to procedure app_key (matches process-manual route). */
export function normalizeAppNameToKey(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[\s\-.]+/g, '_')
      .replace(/[^a-z0-9_]/g, '') || 'unknown'
  )
}
