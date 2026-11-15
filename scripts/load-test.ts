import { performance } from "node:perf_hooks"
import { sql } from "drizzle-orm"
import { createDb } from "@/server/db/client.server"
import { runMigrations } from "@/server/db/migrate.server"
import { env } from "@/server/env.server"
import { ensureInitialCriteria } from "@/server/repos/criteria.server"
import { insertPatient, listPatients } from "@/server/repos/patients.server"
import { insertDonor } from "@/server/repos/donors.server"
import { claimNextRun, enqueueRun } from "@/server/repos/runs.server"
import { processRun } from "@/server/matching/process-run.server"
import { getMatch, listMatches } from "@/server/repos/matches.server"
import { DEMO_DONORS, DEMO_PATIENTS } from "@/domain/demo-data"

// --seed-only fills the dev database (for manual UI checks while a run progresses).
// Otherwise the run TRUNCATEs, so it targets a disposable database: PERF_DATABASE_URL first,
// then TEST_DATABASE_URL. Never point PERF_DATABASE_URL at a database other tests share.
const seedOnly = process.argv.includes("--seed-only")
const url = seedOnly
  ? env().DATABASE_URL
  : (process.env.PERF_DATABASE_URL ?? env().TEST_DATABASE_URL)
if (!url) throw new Error("PERF_DATABASE_URL or TEST_DATABASE_URL required")
const target = new URL(url)
console.log(`Load test target: ${target.hostname}:${target.port}${target.pathname}`)
// --seed-only wipes the dev database first. Require an explicit second flag so it never happens by accident.
if (seedOnly && !process.argv.includes("--wipe-dev-data")) {
  console.error(
    "--seed-only deletes ALL data in the dev database before seeding 2,000 patients. Re-run with --seed-only --wipe-dev-data to confirm."
  )
  process.exit(1)
}

const { pool, db } = createDb(url, { max: 8, statementTimeoutMs: 60_000 })
await runMigrations(db)
await db.execute(
  sql`TRUNCATE decisions, match_results, match_runs, record_snapshots, audit_log, criteria_versions, patients, donors RESTART IDENTITY CASCADE`
)
await ensureInitialCriteria(db)

const P = 2_000
const D = 500
for (let i = 0; i < P; i++) {
  const t = structuredClone(DEMO_PATIENTS[i % DEMO_PATIENTS.length])
  t.id = `load-p-${i}`
  t.identity.mrn = `MRN-${String(9_000_000 + i)}`
  t.listing.state = "active"
  await insertPatient(db, t, "load")
}
for (let i = 0; i < D; i++) {
  const t = structuredClone(DEMO_DONORS[i % DEMO_DONORS.length])
  t.id = `load-d-${i}`
  t.identity.donorId = `LOAD${String(i).padStart(3, "0")}`
  t.identity.state = "available"
  await insertDonor(db, t, "load")
}
await db.execute(sql`ANALYZE`)

if (seedOnly) {
  console.log(`Seeded ${P} patients and ${D} donors.`)
  await pool.end()
  process.exit(0)
}

async function p95(label: string, n: number, fn: () => Promise<unknown>, budgetMs: number) {
  const times: number[] = []
  for (let i = 0; i < n; i++) {
    const s = performance.now()
    await fn()
    times.push(performance.now() - s)
  }
  times.sort((a, b) => a - b)
  const v = times[Math.floor(n * 0.95)]
  console.log(`${v <= budgetMs ? "PASS" : "FAIL"} ${label}: p95 ${v.toFixed(1)} ms (budget ${budgetMs} ms)`)
  return v <= budgetMs
}

const results: boolean[] = []
results.push(await p95("patients list (search)", 50, () => listPatients(db, { q: "chen" }), 40))
results.push(
  await p95(
    "patients list (page 3)",
    50,
    async () => {
      const a = await listPatients(db, {})
      const b = await listPatients(db, { cursor: a.nextCursor! })
      await listPatients(db, { cursor: b.nextCursor! })
    },
    120
  )
)

const runId = await db.transaction((tx) =>
  enqueueRun(tx, { subjectKind: "donor", subjectId: "load-d-0", subjectLabel: "LOAD000", trigger: "manual", actor: "load" })
)
await claimNextRun(db)
const s = performance.now()
const status = await processRun(db, runId)
const rate = P / ((performance.now() - s) / 1000)
const ok = status === "succeeded" && rate >= 500
console.log(`${ok ? "PASS" : "FAIL"} matching throughput: ${rate.toFixed(0)} pairs/s (budget ≥ 500, status ${status})`)
results.push(ok)

results.push(await p95("match results list", 50, () => listMatches(db, {}), 40))
const firstMatch = (await listMatches(db, { runId, order: "screen" })).items[0]
results.push(await p95("match detail", 50, () => getMatch(db, firstMatch.id), 30))

await pool.end()
if (results.includes(false)) process.exit(1)
