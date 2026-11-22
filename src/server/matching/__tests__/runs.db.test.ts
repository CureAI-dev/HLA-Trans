import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { count, eq } from "drizzle-orm"
import { closeTestDb, resetTestDb, testDb } from "../../db/test-db.server"
import { matchResults, matchRuns } from "../../db/schema.server"
import { ensureInitialCriteria } from "../../repos/criteria.server"
import { insertPatient } from "../../repos/patients.server"
import { insertDonor, softDeleteDonor } from "../../repos/donors.server"
import {
  claimNextRun,
  enqueueRun,
  getRun,
  listRunHistory,
  reapStaleRuns,
  requestCancel,
} from "../../repos/runs.server"
import { createDonorWithRun } from "../../services/records.server"
import { listMatches } from "../../repos/matches.server"
import { processRun } from "../process-run.server"
import { DEFAULT_CRITERIA } from "@/domain/criteria"
import { screenDonor } from "@/domain/engine"
import { donor, patient } from "@/domain/__tests__/builders"

const actor = "Dr Ada Okafor"
const now = new Date("2026-11-14T12:00:00Z")

async function setup(activeCount: number) {
  const db = testDb()
  await ensureInitialCriteria(db)
  const ps = Array.from({ length: activeCount }, (_, i) =>
    patient({
      id: `pat_${i}`,
      listing: { state: "active", urgencyStatus: i % 2 ? "A1" : "A3" },
    })
  )
  for (const p of ps) await insertPatient(db, p, actor)
  await insertPatient(
    db,
    patient({ id: "pat_inactive", listing: { state: "inactive" } }),
    actor
  )
  const d = donor({
    id: "don_1",
    identity: { state: "available", ageYears: 30 },
  })
  const { runId } = await createDonorWithRun(db, d, actor)
  return { db, ps, d, runId }
}

describe("match runs", () => {
  beforeEach(resetTestDb)
  afterAll(closeTestDb)

  it("outbox: rolling back the record also rolls back the run", async () => {
    const db = testDb()
    await ensureInitialCriteria(db)
    await db
      .transaction(async (tx) => {
        await insertDonor(tx, donor({ id: "don_x" }), actor)
        await enqueueRun(tx, {
          subjectKind: "donor",
          subjectId: "don_x",
          subjectLabel: "X",
          trigger: "donor.created",
          actor,
        })
        throw new Error("boom")
      })
      .catch(() => undefined)
    const [{ n }] = await db.select({ n: count() }).from(matchRuns)
    expect(n).toBe(0)
  })

  it("processes a donor run over active patients only, in screening order", async () => {
    const { db, ps, d, runId } = await setup(7)
    expect(await claimNextRun(db)).toBe(runId)
    expect(await processRun(db, runId, { chunkSize: 3, now })).toBe("succeeded")
    const run = await getRun(db, runId)
    expect(run).toMatchObject({ status: "succeeded", total: 7, processed: 7 })
    expect(run.passCount + run.reviewCount + run.failCount).toBe(7)
    const page = await listMatches(db, { runId, order: "screen" })
    const expected = screenDonor(d, ps, DEFAULT_CRITERIA, now).map(
      (r) => r.patient.id
    )
    expect(page.items.map((r) => r.patientId)).toEqual(expected)
  })

  it("two concurrent claims never take the same run", async () => {
    const { db, runId } = await setup(1)
    const claims = await Promise.all([claimNextRun(db), claimNextRun(db)])
    expect(claims.filter(Boolean)).toEqual([runId])
  })

  it("recovers from a crash mid-run without duplicates or double counts", async () => {
    const { db, runId } = await setup(5)
    await claimNextRun(db)
    await expect(
      processRun(db, runId, {
        chunkSize: 2,
        now,
        afterChunk: () => {
          throw new Error("crash")
        },
      })
    ).rejects.toThrow("crash")
    await db
      .update(matchRuns)
      .set({ heartbeatAt: new Date(Date.now() - 120_000) })
      .where(eq(matchRuns.id, runId))
    expect(await reapStaleRuns(db)).toBe(1)
    expect(await claimNextRun(db)).toBe(runId)
    expect(await processRun(db, runId, { chunkSize: 2, now })).toBe("succeeded")
    const [{ n }] = await db
      .select({ n: count() })
      .from(matchResults)
      .where(eq(matchResults.runId, runId))
    expect(n).toBe(5)
    const run = await getRun(db, runId)
    expect(run.passCount + run.reviewCount + run.failCount).toBe(5)
  })

  it("cancels queued runs immediately and running runs between chunks", async () => {
    const { db, runId } = await setup(4)
    expect(await requestCancel(db, runId, actor)).toBe("cancelled")
    await expect(requestCancel(db, runId, actor)).rejects.toMatchObject({
      code: "CONFLICT",
    })

    const { runId: run2 } = await createDonorWithRun(
      db,
      donor({ id: "don_2", identity: { state: "available" } }),
      actor
    )
    await claimNextRun(db)
    await requestCancel(db, run2, actor)
    expect(await processRun(db, run2, { chunkSize: 1, now })).toBe("cancelled")
  })

  it("cancels when the subject was deleted before processing", async () => {
    const { db, runId } = await setup(2)
    await softDeleteDonor(db, "don_1", actor)
    await claimNextRun(db)
    expect(await processRun(db, runId, { now })).toBe("cancelled")
  })

  it("fails after MAX_ATTEMPTS stale heartbeats", async () => {
    const { db, runId } = await setup(1)
    for (let i = 0; i < 3; i++) {
      await claimNextRun(db)
      await db
        .update(matchRuns)
        .set({ heartbeatAt: new Date(Date.now() - 120_000) })
        .where(eq(matchRuns.id, runId))
      await reapStaleRuns(db)
    }
    expect((await getRun(db, runId)).status).toBe("failed")
  })

  it("filters history by status and an inclusive day range", async () => {
    const db = testDb()
    await ensureInitialCriteria(db)
    const queue = async (id: string, day: string) => {
      const runId = await enqueueRun(db, {
        subjectKind: "donor",
        subjectId: id,
        subjectLabel: id,
        trigger: "manual",
        actor,
      })
      await db
        .update(matchRuns)
        .set({ createdAt: new Date(`${day}T10:00:00`) })
        .where(eq(matchRuns.id, runId))
      return runId
    }
    const early = await queue("don_a", "2026-11-01")
    const mid = await queue("don_b", "2026-11-05")
    const late = await queue("don_c", "2026-11-09")
    await requestCancel(db, mid, actor)

    const ids = async (input: Parameters<typeof listRunHistory>[1]) =>
      (await listRunHistory(db, input)).items.map((r) => r.id)
    expect(await ids({ from: "2026-11-05", to: "2026-11-09" })).toEqual([
      late,
      mid,
    ])
    expect(await ids({ to: "2026-11-01" })).toEqual([early])
    expect(await ids({ status: "queued", from: "2026-11-01" })).toEqual([
      late,
      early,
    ])
  })
})
