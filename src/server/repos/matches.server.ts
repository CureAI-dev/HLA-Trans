import { and, asc, desc, eq, isNotNull, isNull, sql } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import {
  criteriaVersions,
  decisions,
  donors,
  matchResults,
  patients,
  recordSnapshots,
} from "../db/schema.server"
import type { Db, Executor } from "../db/client.server"
import { appendAudit } from "./audit.server"
import { getCriteriaVersion, latestCriteria } from "./criteria.server"
import { getDonor } from "./donors.server"
import { getPatient } from "./patients.server"
import { putSnapshots } from "./snapshots.server"
import { after, first, parseCursor, toPage, withinDays } from "./sql.server"
import { evaluate } from "@/domain/engine"
import { newId } from "@/domain/factories"
import { decisionSchema, pairInputsSchema } from "@/domain/schema"
import type {
  Decision,
  Donor,
  Outcome,
  PairInputs,
  Patient,
} from "@/domain/schema"
import type { MatchDetail, MatchRow } from "@/domain/match-types"
import { AppError } from "@/lib/app-error"
import type { Page } from "@/lib/cursor"

export type MatchListInput = {
  overall?: Outcome
  decision?: "pending" | "decided"
  source?: "screening" | "checked"
  patientId?: string
  donorId?: string
  runId?: string
  /** Local calendar dates (YYYY-MM-DD), inclusive. */
  from?: string
  to?: string
  order?: "recent" | "screen"
  cursor?: string
  limit?: number
}

const latestCriteriaId = sql`(select id from ${criteriaVersions} order by version desc limit 1)`
const outOfDate = sql<boolean>`(
  ${patients.contentHash} <> ${matchResults.patientSnapshot}
  or ${donors.contentHash} <> ${matchResults.donorSnapshot}
  or ${matchResults.criteriaVersionId} <> ${latestCriteriaId}
)`
const screenKeyC = sql`${matchResults.screenKey} collate "C"`

export async function listMatches(
  exec: Executor,
  input: MatchListInput
): Promise<Page<MatchRow>> {
  const limit = Math.min(input.limit ?? 50, 200)
  const order = input.order ?? "recent"
  const cursor = parseCursor(input.cursor)
  const rows = await exec
    .select({
      id: matchResults.id,
      source: matchResults.source,
      runId: matchResults.runId,
      patientId: matchResults.patientId,
      donorId: matchResults.donorId,
      patientName: matchResults.patientName,
      donorCode: matchResults.donorCode,
      overall: matchResults.overall,
      blockerCount: matchResults.blockerCount,
      missingCount: matchResults.missingCount,
      criteriaVersion: criteriaVersions.version,
      decision: decisions.verdict,
      outOfDate,
      createdAt: matchResults.createdAt,
      screenKey: matchResults.screenKey,
    })
    .from(matchResults)
    .innerJoin(patients, eq(patients.id, matchResults.patientId))
    .innerJoin(donors, eq(donors.id, matchResults.donorId))
    .innerJoin(
      criteriaVersions,
      eq(criteriaVersions.id, matchResults.criteriaVersionId)
    )
    .leftJoin(decisions, eq(decisions.matchId, matchResults.id))
    .where(
      and(
        input.overall ? eq(matchResults.overall, input.overall) : undefined,
        input.source ? eq(matchResults.source, input.source) : undefined,
        input.decision === "pending"
          ? isNull(decisions.id)
          : input.decision === "decided"
            ? isNotNull(decisions.id)
            : undefined,
        input.patientId
          ? eq(matchResults.patientId, input.patientId)
          : undefined,
        input.donorId ? eq(matchResults.donorId, input.donorId) : undefined,
        input.runId ? eq(matchResults.runId, input.runId) : undefined,
        withinDays(matchResults.createdAt, input.from, input.to),
        cursor
          ? order === "screen"
            ? after(screenKeyC, matchResults.id, cursor, "asc")
            : after(
                matchResults.createdAt,
                matchResults.id,
                cursor,
                "desc",
                "timestamptz"
              )
          : undefined
      )
    )
    .orderBy(
      ...(order === "screen"
        ? [asc(screenKeyC), asc(matchResults.id)]
        : [desc(matchResults.createdAt), desc(matchResults.id)])
    )
    .limit(limit + 1)
  const items = rows.map(({ createdAt, screenKey, ...r }) => ({
    ...r,
    createdAt: createdAt.toISOString(),
    _k: order === "screen" ? (screenKey ?? "") : createdAt.toISOString(),
  }))
  const page = toPage(items, limit, (r) => ({ k: r._k, id: r.id }))
  return { ...page, items: page.items.map(({ _k: _, ...r }) => r) }
}

const pSnap = alias(recordSnapshots, "p_snap")
const dSnap = alias(recordSnapshots, "d_snap")

export async function getMatch(
  exec: Executor,
  id: string
): Promise<MatchDetail> {
  const row = first(
    await exec
      .select({
        m: matchResults,
        patient: pSnap.data,
        donor: dSnap.data,
        decision: decisions,
        outOfDate,
      })
      .from(matchResults)
      .innerJoin(pSnap, eq(pSnap.hash, matchResults.patientSnapshot))
      .innerJoin(dSnap, eq(dSnap.hash, matchResults.donorSnapshot))
      .innerJoin(patients, eq(patients.id, matchResults.patientId))
      .innerJoin(donors, eq(donors.id, matchResults.donorId))
      .leftJoin(decisions, eq(decisions.matchId, matchResults.id))
      .where(eq(matchResults.id, id))
  )
  if (!row) throw new AppError("NOT_FOUND", "Match result not found.")
  const criteria = await getCriteriaVersion(exec, row.m.criteriaVersionId)
  return {
    id: row.m.id,
    source: row.m.source,
    runId: row.m.runId,
    createdAt: row.m.createdAt.toISOString(),
    createdBy: row.m.createdBy,
    patientId: row.m.patientId,
    donorId: row.m.donorId,
    patient: row.patient as Patient,
    donor: row.donor as Donor,
    criteriaVersionId: criteria.id,
    criteriaVersion: criteria.version,
    criteria: criteria.criteria,
    pair: row.m.pair,
    result: row.m.result,
    decision: row.decision
      ? {
          verdict: row.decision.verdict,
          reasons: row.decision.reasons,
          clinician: row.decision.clinician,
          rationale: row.decision.rationale,
          acknowledgedFindings: row.decision.acknowledgedFindings,
          decidedAt: row.decision.decidedAt.toISOString(),
        }
      : null,
    outOfDate: row.outOfDate,
  }
}

export async function checkPair(
  db: Db,
  input: { patientId: string; donorId: string; pair: PairInputs },
  actor: string
): Promise<{ id: string }> {
  const pair = pairInputsSchema.parse(input.pair)
  return db.transaction(async (tx) => {
    const [{ record: patient }, { record: donor }, criteria] =
      await Promise.all([
        getPatient(tx, input.patientId),
        getDonor(tx, input.donorId),
        latestCriteria(tx),
      ])
    const now = new Date()
    const result = evaluate({
      patient,
      donor,
      pair,
      criteria: criteria.criteria,
      now,
    })
    const [patientSnapshot, donorSnapshot] = await putSnapshots(tx, [
      { kind: "patient", data: patient },
      { kind: "donor", data: donor },
    ])
    const id = newId("mat")
    await tx.insert(matchResults).values({
      id,
      runId: null,
      source: "checked",
      patientId: patient.id,
      donorId: donor.id,
      patientName:
        `${patient.identity.firstName} ${patient.identity.lastName}`.trim(),
      donorCode: donor.identity.donorId,
      patientSnapshot,
      donorSnapshot,
      criteriaVersionId: criteria.id,
      engineVersion: result.engineVersion,
      pair,
      result,
      overall: result.overall,
      blockerCount: result.blockers.length,
      missingCount: result.missingCount,
      screenKey: null,
      createdBy: actor,
      createdAt: now,
    })
    await appendAudit(tx, {
      actor,
      action: "match.checked",
      subjectId: id,
      summary: `Checked ${donor.identity.donorId} for ${patient.identity.mrn}`,
      at: now,
    })
    return { id }
  })
}

export async function decideMatch(
  db: Db,
  matchId: string,
  input: Omit<Decision, "decidedAt">,
  actor: string
): Promise<void> {
  const now = new Date()
  const decision = decisionSchema.parse({
    ...input,
    clinician: input.clinician.trim(),
    rationale: input.rationale.trim(),
    decidedAt: now.toISOString(),
  })
  if (decision.verdict === "decline" && decision.reasons.length === 0)
    throw new AppError("VALIDATION", "Select at least one decline reason.", {
      reasons: "Select at least one decline reason.",
    })
  await db.transaction(async (tx) => {
    const m = first(
      await tx
        .select({ source: matchResults.source, result: matchResults.result })
        .from(matchResults)
        .where(eq(matchResults.id, matchId))
        .for("share")
    )
    if (!m) throw new AppError("NOT_FOUND", "Match result not found.")
    if (m.source !== "checked")
      throw new AppError(
        "VALIDATION",
        "Complete this match with pair inputs before recording a decision."
      )
    const findings = [
      ...m.result.blockers,
      ...m.result.rules.flatMap((r) => r.findings),
    ]
    const needsAck =
      m.result.overall !== "pass" ||
      findings.some((f) => f.status === "fail" || f.status === "review")
    if (needsAck && !decision.acknowledgedFindings)
      throw new AppError(
        "VALIDATION",
        "Acknowledge all FAIL and REVIEW findings before recording a decision.",
        { acknowledgedFindings: "Required" }
      )
    const inserted = await tx
      .insert(decisions)
      .values({ id: newId("dec"), matchId, ...decision, decidedAt: now })
      .onConflictDoNothing({ target: decisions.matchId })
      .returning({ id: decisions.id })
    if (!inserted.length)
      throw new AppError(
        "CONFLICT",
        "This match result already has a final decision."
      )
    await appendAudit(tx, {
      actor,
      action: "match.decided",
      subjectId: matchId,
      summary: `Recorded ${decision.verdict} decision`,
      at: now,
    })
  })
}
