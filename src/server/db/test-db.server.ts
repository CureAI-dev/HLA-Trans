import { sql } from "drizzle-orm"
import { createDb } from "./client.server"
import type { Db, DbHandle } from "./client.server"
import { env } from "../env.server"

let handle: DbHandle | undefined

export function testDb(): Db {
  const url = env().TEST_DATABASE_URL
  if (!url) throw new Error("TEST_DATABASE_URL is required for db tests.")
  handle ??= createDb(url, { max: 6, statementTimeoutMs: 10_000 })
  return handle.db
}

export function testPool() {
  testDb()
  return handle!.pool
}

/** TRUNCATE bypasses the row-level immutability triggers by design. */
export async function resetTestDb(): Promise<void> {
  await testDb().execute(
    sql`TRUNCATE decisions, match_results, match_runs, record_snapshots, audit_log, criteria_versions, patients, donors RESTART IDENTITY CASCADE`
  )
}

export async function closeTestDb(): Promise<void> {
  await handle?.pool.end()
  handle = undefined
}
