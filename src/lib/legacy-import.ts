const LEGACY_KEY = "hla-trans.db.v1"
const DONE_KEY = "hla-trans.db.v1.imported"

/** Reads the v1 localStorage database once. Returns null when absent, already imported, or unreadable. */
export function readLegacyBackup(): unknown {
  try {
    if (localStorage.getItem(DONE_KEY)) return null
    const raw = localStorage.getItem(LEGACY_KEY)
    return raw ? (JSON.parse(raw) as unknown) : null
  } catch {
    return null
  }
}

export function markLegacyImported(): void {
  try {
    localStorage.setItem(DONE_KEY, new Date().toISOString())
  } catch {
    /* Banner may reappear; import is idempotent. */
  }
}

export function hasLegacyData(): boolean {
  try {
    return localStorage.getItem(LEGACY_KEY) !== null
  } catch {
    return false
  }
}

export function deleteLegacyData(): void {
  try {
    localStorage.removeItem(LEGACY_KEY)
  } catch {
    /* Storage blocked: nothing to delete. */
  }
}
