import handler from "@tanstack/react-start/server-entry"
import { createDb } from "@/server/db/client.server"
import { drainRuns } from "@/server/matching/drain.server"
import { reapStaleRuns } from "@/server/repos/runs.server"
import { workerScope } from "@/server/scope.server"
import type { WorkerScope } from "@/server/scope.server"

/**
 * Cloudflare Workers entry (wrangler.jsonc "main"). Replaces the Bun worker process:
 * - fetch: the TanStack Start app.
 * - queue: MATCH_RUNS messages are wake-ups; the consumer drains whatever is queued.
 * - scheduled: every minute, requeue stale runs and drain anything a lost message left behind.
 */

// Queue consumers and cron ticks get 15 min wall time; stop early and release the run at a
// chunk boundary so the next invocation resumes it.
const QUEUE_BUDGET_MS = 10 * 60_000
// Cron fires every minute, so keep each tick short to avoid piling up invocations.
const CRON_BUDGET_MS = 50_000

async function inScope<T>(
  env: Env,
  ctx: ExecutionContext,
  fn: (scope: WorkerScope) => Promise<T>
): Promise<T> {
  const scope: WorkerScope = {
    db: createDb(env.HYPERDRIVE.connectionString, { max: 5 }).db,
    wake: new Set(),
  }
  return workerScope.run(scope, async () => {
    try {
      return await fn(scope)
    } finally {
      // Runs after the handler, so wake-ups from committed writes are sent once.
      // A failed send is not fatal: the cron tick drains queued runs anyway.
      if (scope.wake.size)
        ctx.waitUntil(
          env.MATCH_RUNS.sendBatch(
            [...scope.wake].map((body) => ({ body }))
          ).catch((error: unknown) =>
            console.error("[queue] send failed:", error)
          )
        )
    }
  })
}

const until = (ms: number) => {
  const deadline = Date.now() + ms
  return () => Date.now() > deadline
}

export default {
  fetch(request, env, ctx) {
    return inScope(env, ctx, async () => handler.fetch(request))
  },

  async queue(batch, env, ctx) {
    await inScope(env, ctx, ({ db }) => drainRuns(db, until(QUEUE_BUDGET_MS)))
    batch.ackAll()
  },

  async scheduled(_controller, env, ctx) {
    await inScope(env, ctx, async ({ db }) => {
      const reaped = await reapStaleRuns(db)
      if (reaped) console.info(`[cron] reaped ${reaped} stale run(s)`)
      await drainRuns(db, until(CRON_BUDGET_MS))
    })
  },
} satisfies ExportedHandler<Env>
