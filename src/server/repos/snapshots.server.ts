import { createHash } from "node:crypto"
import { recordSnapshots } from "../db/schema.server"
import type { Executor } from "../db/client.server"
import type { Donor, Patient } from "@/domain/schema"

/** Deterministic JSON: object keys sorted recursively, arrays kept in order. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`
}

export const snapshotHash = (value: unknown): string =>
  createHash("sha256").update(canonicalJson(value)).digest("hex")

type SnapshotInput =
  { kind: "patient"; data: Patient } | { kind: "donor"; data: Donor }

/** Inserts each distinct record once. Returns hashes in input order. O(n) hashing, one statement. */
export async function putSnapshots(
  exec: Executor,
  items: SnapshotInput[]
): Promise<string[]> {
  const hashes = items.map((item) => snapshotHash(item.data))
  const unique = new Map<string, SnapshotInput>()
  items.forEach((item, i) => unique.set(hashes[i], item))
  if (unique.size)
    await exec
      .insert(recordSnapshots)
      .values(
        [...unique].map(([hash, item]) => ({
          hash,
          kind: item.kind,
          data: item.data,
        }))
      )
      .onConflictDoNothing()
  return hashes
}
