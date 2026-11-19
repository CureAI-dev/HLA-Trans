import { AsyncLocalStorage } from "node:async_hooks"
import type { Db } from "./db/client.server"

/**
 * Per-invocation state on Cloudflare Workers (one fetch, queue batch or cron tick).
 * Workers cannot reuse sockets across requests, so each invocation gets its own pool,
 * and Hyperdrive has no LISTEN/NOTIFY, so run ids to wake are collected here and sent
 * to the MATCH_RUNS queue when the invocation ends (see src/server.ts).
 * Absent under Bun (worker process, scripts, tests), which keep the global pool and pg_notify.
 */
export type WorkerScope = { db: Db; wake: Set<string> }

export const workerScope = new AsyncLocalStorage<WorkerScope>()
