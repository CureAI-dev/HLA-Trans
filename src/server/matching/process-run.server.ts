import { and, eq, sql } from "drizzle-orm"
import { matchResults, matchRuns } from "../db/schema.server"
import type { Db } from "../db/client.server"
import { getCriteriaVersion } from "../repos/criteria.server"
import { activePatients, getPatient } from "../repos/patients.server"
import { availableDonors, getDonor } from "../repos/donors.server"
import { finishRun, releaseRun } from "../repos/runs.server"
import { putSnapshots } from "../repos/snapshots.server"
import { first } from "../repos/sql.server"
import { evaluate, isPediatricDonor, screenRow } from "@/domain/engine"
import { defaultPairInputs, newId } from "@/domain/factories"
import { donorScreenKey, patientScreenKey } from "@/domain/screen-key"
import type { Donor, EvaluationResult, Patient } from "@/domain/schema"
import type { RunStatus } from "@/domain/match-types"
import { isAppError } from "@/lib/app-error"

export type ProcessOptions = {
  chunkSize?: number
  now?: Date
  /** Checked between chunks; true → release the run back to the queue. */
  shouldStop?: () => boolean
  /** Test hook: runs after each committed chunk (throw to simulate a crash). */
  afterChunk?: (chunkIndex: number) => void
}

const MAX_CHUNK = 50

const byId =<T extends { id: string }>(a: T, b: T) =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0
const nameOf = (p: Patient) =>
  `${p.identity.firstName} ${p.identity.lastName}`.trim()

export async function processRun(
  db: Db,
  runId: string,
  opts: ProcessOptions = {}
): Promise<RunStatus> {
  const now = opts.now ?? new Date() // one clock per run: ages and durations are consistent
  const run = first(
    await db.select().from(matchRuns).where(eq(matchRuns.id, runId))
  )
  if (!run || run.status !== "running") return run?.status ?? "failed"
  const criteria = await getCriteriaVersion(db, run.criteriaVersionId)

  let subject: Patient | Donor
  try {
    subject =
      run.subjectKind === "donor"
        ? (await getDonor(db, run.subjectId)).record
        : (await getPatient(db, run.subjectId)).record
  } catch (error) {
    if (isAppError(error) && error.code === "NOT_FOUND") {
      await finishRun(
        db,
        runId,
        "cancelled",
        "The record was deleted before matching finished."
      )
      return "cancelled"
    }
    throw error
  }

  // Sorted by id so a resumed run walks the same chunks; the unique index skips done pairs.
  const counterparts: Array<Patient | Donor> =
    run.subjectKind === "donor"
      ? (await activePatients(db)).sort(byId)
      : (await availableDonors(db)).sort(byId)
  const [subjectHash] = await putSnapshots(db, [
    run.subjectKind === "donor"
      ? { kind: "donor", data: subject as Donor }
      : { kind: "patient", data: subject as Patient },
  ])
  await db
    .update(matchRuns)
    .set({ total: counterparts.length, heartbeatAt: new Date() })
    .where(eq(matchRuns.id, runId))
  // Aim for ~20 progress steps so small runs don't jump straight from 0% to 100%.
  const chunkSize =
    opts.chunkSize ??
    Math.min(MAX_CHUNK, Math.max(1, Math.ceil(counterparts.length / 20)))
  const pediatricDonor =
    run.subjectKind === "donor" && isPediatricDonor(subject as Donor)
  const pair = defaultPairInputs()

  for (
    let start = 0, chunkIndex = 0;
    start < counterparts.length;
    start += chunkSize, chunkIndex++
  ) {
    const state = first(
      await db
        .select({ cancel: matchRuns.cancelRequested, status: matchRuns.status })
        .from(matchRuns)
        .where(eq(matchRuns.id, runId))
    )
    if (!state || state.status !== "running") return state?.status ?? "failed"
    if (state.cancel) {
      await finishRun(db, runId, "cancelled", null)
      return "cancelled"
    }
    if (opts.shouldStop?.()) {
      await releaseRun(db, runId)
      return "queued"
    }

    const chunk = counterparts.slice(start, start + chunkSize)
    const computed = chunk.map((other) => {
      const patient = (run.subjectKind === "donor" ? other : subject) as Patient
      const donor = (run.subjectKind === "donor" ? subject : other) as Donor
      let result: EvaluationResult, screenKey: string
      if (run.subjectKind === "donor") {
        const row = screenRow(donor, patient, criteria.criteria, now)
        result = row.result
        screenKey = donorScreenKey(row, pediatricDonor)
      } else {
        result = evaluate({
          patient,
          donor,
          pair,
          criteria: criteria.criteria,
          now,
        })
        screenKey = patientScreenKey(result.overall, donor.id)
      }
      return { patient, donor, result, screenKey }
    })

    await db.transaction(async (tx) => {
      const hashes = await putSnapshots(
        tx,
        chunk.map((c) =>
          run.subjectKind === "donor"
            ? { kind: "patient" as const, data: c as Patient }
            : { kind: "donor" as const, data: c as Donor }
        )
      )
      const createdAt = new Date()
      const inserted = await tx
        .insert(matchResults)
        .values(
          computed.map((c, i) => ({
            id: newId("mat"),
            runId,
            source: "screening" as const,
            patientId: c.patient.id,
            donorId: c.donor.id,
            patientName: nameOf(c.patient),
            donorCode: c.donor.identity.donorId,
            patientSnapshot:
              run.subjectKind === "donor" ? hashes[i] : subjectHash,
            donorSnapshot:
              run.subjectKind === "donor" ? subjectHash : hashes[i],
            criteriaVersionId: criteria.id,
            engineVersion: c.result.engineVersion,
            pair,
            result: c.result,
            overall: c.result.overall,
            blockerCount: c.result.blockers.length,
            missingCount: c.result.missingCount,
            screenKey: c.screenKey,
            createdBy: run.createdBy,
            createdAt,
          }))
        )
        .onConflictDoNothing()
        .returning({ overall: matchResults.overall })
      const n = (o: string) => inserted.filter((r) => r.overall === o).length
      await tx
        .update(matchRuns)
        .set({
          processed: start + chunk.length,
          passCount: sql`${matchRuns.passCount} + ${n("pass")}`,
          reviewCount: sql`${matchRuns.reviewCount} + ${n("review")}`,
          failCount: sql`${matchRuns.failCount} + ${n("fail")}`,
          heartbeatAt: new Date(),
        })
        .where(and(eq(matchRuns.id, runId), eq(matchRuns.status, "running")))
    })
    opts.afterChunk?.(chunkIndex)
  }

  await finishRun(db, runId, "succeeded", null)
  return "succeeded"
}
