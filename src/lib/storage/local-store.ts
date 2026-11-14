import { useSyncExternalStore } from "react"
import type { z } from "zod"

/**
 * A typed, schema-validated, cross-tab-synchronised store backed by one
 * localStorage key.
 *
 * - Reads are validated with zod. Corrupt data is never silently discarded:
 *   the raw string is copied to a backup key before the store resets.
 * - Writes are synchronous and atomic (one setItem per commit).
 * - Quota / access failures surface as StorageWriteError so the UI can report
 *   them instead of losing data silently.
 * - SSR safe: on the server (or before hydration) the snapshot is `null`.
 */

export class StorageWriteError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = "StorageWriteError"
  }
}

export type LocalStore<T> = {
  /** Current value. Returns null on the server. */
  get: () => T | null
  /** Replace the value. Throws StorageWriteError if the browser rejects it. */
  set: (next: T) => void
  /** Functional update. Throws StorageWriteError if the browser rejects it. */
  update: (fn: (current: T) => T) => T
  subscribe: (listener: () => void) => () => void
  /** Bytes used by this key (UTF-16 => 2 bytes per char). */
  sizeInBytes: () => number
  /** Recovery message produced while loading, if any. */
  recoveryNotice: () => string | null
}

const isBrowser = (): boolean =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined"

export function createLocalStore<T>(options: {
  key: string
  schema: z.ZodType<T>
  initial: () => T
  /** Upgrade older persisted shapes before validation. */
  migrate?: (raw: unknown) => unknown
}): LocalStore<T> {
  const { key, schema, initial, migrate } = options
  const listeners = new Set<() => void>()
  let cache: T | null = null
  let notice: string | null = null

  const load = (): T => {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return initial()
    try {
      const parsed: unknown = JSON.parse(raw)
      const result = schema.safeParse(migrate ? migrate(parsed) : parsed)
      if (result.success) return result.data
      throw new Error(result.error.issues[0]?.message ?? "Schema mismatch")
    } catch (error) {
      const backupKey = `${key}.corrupt.${Date.now()}`
      try {
        window.localStorage.setItem(backupKey, raw)
        notice = `Saved data could not be read (${error instanceof Error ? error.message : "unknown error"}). A copy was kept under "${backupKey}" and the app started with empty data.`
      } catch {
        notice = `Saved data could not be read and no backup could be written. The app started with empty data.`
      }
      return initial()
    }
  }

  const ensure = (): T | null => {
    if (!isBrowser()) return null
    if (cache === null) cache = load()
    return cache
  }

  const emit = () => {
    for (const listener of listeners) listener()
  }

  const write = (next: T) => {
    const validated = schema.parse(next)
    try {
      window.localStorage.setItem(key, JSON.stringify(validated))
    } catch (error) {
      const quota =
        error instanceof DOMException &&
        (error.name === "QuotaExceededError" || error.code === 22)
      throw new StorageWriteError(
        quota
          ? "Browser storage is full. Export a backup and delete old records."
          : "The browser blocked saving data.",
        { cause: error }
      )
    }
    cache = validated
    emit()
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key !== key) return
    cache = null
    emit()
  }

  return {
    get: ensure,
    set: (next) => {
      if (!isBrowser()) throw new StorageWriteError("Storage is unavailable.")
      write(next)
    },
    update: (fn) => {
      const current = ensure()
      if (current === null) throw new StorageWriteError("Storage is unavailable.")
      const next = fn(current)
      write(next)
      return next
    },
    subscribe: (listener) => {
      listeners.add(listener)
      if (listeners.size === 1 && isBrowser()) {
        window.addEventListener("storage", onStorage)
      }
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0 && isBrowser()) {
          window.removeEventListener("storage", onStorage)
        }
      }
    },
    sizeInBytes: () => {
      if (!isBrowser()) return 0
      return (window.localStorage.getItem(key)?.length ?? 0) * 2
    },
    recoveryNotice: () => notice,
  }
}

/** Subscribe a component to a store. Returns null until hydrated on the client. */
export function useLocalStore<T>(store: LocalStore<T>): T | null {
  return useSyncExternalStore(store.subscribe, store.get, () => null)
}
