import type { Db } from "../db/client.server"
import { claimNextRun, failOrRequeue } from "../repos/runs.server"
import { processRun } from "./process-run.server"

/**
 * Claims and processes queued runs until none are left or shouldStop() turns true.
 * A run interrupted by shouldStop is released back to the queue at a chunk boundary.
 * Shared by the Bun worker loop and the Cloudflare queue/cron handlers.
 */
export async function drainRuns(
  db: Db,
  shouldStop: () => boolean
): Promise<number> {
  let processed = 0
  let id: string | null
  while (!shouldStop() && (id = await claimNextRun(db))) {
    const started = performance.now()
    try {
      const status = await processRun(db, id, { shouldStop })
      console.info(
        `[worker] ${id} ${status} in ${Math.round(performance.now() - started)} ms`
      )
    } catch (error) {
      console.error(`[worker] ${id} failed:`, error)
      await failOrRequeue(db, id, error)
    }
    processed++
  }
  return processed
}
