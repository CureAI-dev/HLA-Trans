import { z } from "zod"

/** Keyset position: k is the sort value as text, id breaks ties. */
export type Cursor = { k: string; id: string }
const cursorSchema = z.object({
  k: z.string().max(400),
  id: z.string().min(1).max(64),
})

const toBase64Url = (s: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(s)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
const fromBase64Url = (s: string) => {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/")
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

export function encodeCursor(cursor: Cursor): string {
  return toBase64Url(JSON.stringify(cursor))
}

export function decodeCursor(value: string): Cursor | null {
  try {
    const parsed = cursorSchema.safeParse(JSON.parse(fromBase64Url(value)))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export type Page<T> = { items: T[]; nextCursor: string | null }
