import { Pool } from "pg"
import { drizzle } from "drizzle-orm/node-postgres"
import type { NodePgDatabase } from "drizzle-orm/node-postgres"
import * as schema from "./schema.server"
import { env } from "../env.server"

export type Db = NodePgDatabase<typeof schema>
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0]
/** Repositories accept either the pool-backed db or an open transaction. */
export type Executor = Db | Tx

export type DbHandle = { pool: Pool; db: Db }

export function createDb(
  url: string,
  opts: { max: number; statementTimeoutMs: number }
): DbHandle {
  const pool = new Pool({
    connectionString: url,
    max: opts.max,
    idleTimeoutMillis: 30_000,
    statement_timeout: opts.statementTimeoutMs,
  })
  // Without a listener, an idle-client error (e.g. Postgres restart) crashes the process.
  pool.on("error", (error) => console.error("[db] idle client error:", error.message))
  return { pool, db: drizzle({ client: pool, schema }) }
}

const store = globalThis as typeof globalThis & { __hlaWebDb?: DbHandle }

/** One pool per web process; the globalThis slot survives Vite HMR module reloads. */
export function getDb(): Db {
  store.__hlaWebDb ??= createDb(env().DATABASE_URL, { max: 10, statementTimeoutMs: 5_000 })
  return store.__hlaWebDb.db
}
