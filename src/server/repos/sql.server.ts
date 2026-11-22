import { and, gte, lt, sql } from "drizzle-orm"
import type { AnyColumn, SQL } from "drizzle-orm"
import { decodeCursor, encodeCursor } from "@/lib/cursor"
import type { Cursor, Page } from "@/lib/cursor"
import { AppError } from "@/lib/app-error"

/** Escapes LIKE wildcards; Postgres' default LIKE escape char is backslash. */
export const likeContains = (q: string) => `%${q.replace(/[\\%_]/g, "\\$&")}%`

export function parseCursor(value: string | undefined): Cursor | null {
  if (!value) return null
  const cursor = decodeCursor(value)
  if (!cursor)
    throw new AppError(
      "VALIDATION",
      "The page link is invalid. Start from the first page."
    )
  return cursor
}

/**
 * Row-value comparison matching ORDER BY (key dir, id dir), so Postgres can walk the
 * composite index. Timestamp keys travel as ISO text and are cast back, which is exact
 * because every timestamp is written with millisecond precision.
 */
export function after(
  key: SQL | AnyColumn,
  id: AnyColumn,
  cursor: Cursor,
  dir: "asc" | "desc",
  keyType: "text" | "timestamptz" = "text"
): SQL {
  const k =
    keyType === "timestamptz" ? sql`${cursor.k}::timestamptz` : sql`${cursor.k}`
  return dir === "desc"
    ? sql`(${key}, ${id}) < (${k}, ${cursor.id})`
    : sql`(${key}, ${id}) > (${k}, ${cursor.id})`
}

export function toPage<T>(
  rows: T[],
  limit: number,
  keyOf: (row: T) => Cursor
): Page<T> {
  const items = rows.slice(0, limit)
  const last = items.at(-1)
  return {
    items,
    nextCursor: rows.length > limit && last ? encodeCursor(keyOf(last)) : null,
  }
}

/** First row or undefined. Destructuring `[row]` types as always present (no noUncheckedIndexedAccess). */
export const first = <T>(rows: T[]): T | undefined => rows[0]

/**
 * Inclusive calendar-day range filter (YYYY-MM-DD) on a timestamp column.
 * `to` covers the whole day, so the upper bound is the next midnight.
 */
export function withinDays(
  column: AnyColumn,
  from: string | undefined,
  to: string | undefined
): SQL | undefined {
  return and(
    from ? gte(column, new Date(`${from}T00:00:00`)) : undefined,
    to
      ? lt(column, new Date(new Date(`${to}T00:00:00`).getTime() + 86_400_000))
      : undefined
  )
}
