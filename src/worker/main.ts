import { createDb } from "@/server/db/client.server"
import { runMigrations } from "@/server/db/migrate.server"
import { env } from "@/server/env.server"
import { drainRuns } from "@/server/matching/drain.server"
import { NOTIFY_CHANNEL, reapStaleRuns } from "@/server/repos/runs.server"

const POLL_MS = 5_000
const REAP_MS = 30_000

const { pool, db } = createDb(env().DATABASE_URL, {
  max: 4,
  statementTimeoutMs: 30_000,
})
if (process.env.NODE_ENV !== "production") await runMigrations(db)

// Set by signal handlers. Read through a function so TS does not narrow it to a constant.
let stopping = false
const isStopping = () => stopping
let wake: (() => void) | null = null
const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      wake = null
      resolve()
    }, ms)
    wake = () => {
      clearTimeout(timer)
      wake = null
      resolve()
    }
  })

const listener = await pool.connect()
listener.on("notification", () => wake?.())
listener.on("error", (error) => {
  // Lost the LISTEN connection: exit so the supervisor (bun --watch / systemd) restarts cleanly.
  console.error("[worker] listener error:", error.message)
  process.exit(1)
})
await listener.query(`LISTEN ${NOTIFY_CHANNEL}`)

const reaper = setInterval(() => {
  reapStaleRuns(db).then(
    (n) => n && console.info(`[worker] reaped ${n} stale run(s)`),
    (e: unknown) => console.error("[worker] reaper failed:", e)
  )
}, REAP_MS)

for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    stopping = true
    wake?.()
  })

console.info("[worker] ready")
while (!isStopping()) {
  await drainRuns(db, isStopping)
  if (!isStopping()) await sleep(POLL_MS)
}

clearInterval(reaper)
listener.release()
await pool.end()
console.info("[worker] stopped")
