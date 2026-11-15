import { isNull, sql } from "drizzle-orm"
import {
  auditLog,
  criteriaVersions,
  decisions,
  donors,
  matchResults,
  patients,
} from "../db/schema.server"
import type { Db, Executor, Tx } from "../db/client.server"
import { appendAudit } from "./audit.server"
import { ensureInitialCriteria, listCriteriaVersions } from "./criteria.server"
import { donorCols } from "./donors.server"
import { patientCols } from "./patients.server"
import { enqueueRun } from "./runs.server"
import { putSnapshots } from "./snapshots.server"
import { validatedDbSchema } from "@/domain/backup-schema"
import { DEMO_DONORS, DEMO_PATIENTS } from "@/domain/demo-data"
import { LEGACY_AUDIT_ACTION } from "@/domain/match-types"
import type { CriteriaVersion, Donor, Patient } from "@/domain/schema"
import { AppError } from "@/lib/app-error"

export type ImportSummary = {
  patients: number
  donors: number
  matches: number
  decisions: number
  skipped: number
}

async function upsertPatients(
  tx: Tx,
  list: Patient[],
  deletedAt: Date | null
): Promise<number> {
  let inserted = 0
  for (const r of list) {
    const rows = await tx
      .insert(patients)
      .values({
        id: r.id,
        version: 1,
        createdAt: new Date(r.createdAt),
        updatedAt: new Date(r.updatedAt),
        deletedAt,
        ...patientCols(r),
        data: r,
      })
      .onConflictDoNothing()
      .returning({ id: patients.id })
    inserted += rows.length
  }
  return inserted
}

async function upsertDonors(
  tx: Tx,
  list: Donor[],
  deletedAt: Date | null
): Promise<number> {
  let inserted = 0
  for (const r of list) {
    const rows = await tx
      .insert(donors)
      .values({
        id: r.id,
        version: 1,
        createdAt: new Date(r.createdAt),
        updatedAt: new Date(r.updatedAt),
        deletedAt,
        ...donorCols(r),
        data: r,
      })
      .onConflictDoNothing()
      .returning({ id: donors.id })
    inserted += rows.length
  }
  return inserted
}

/** All-or-nothing. Existing ids are skipped (reported), never overwritten. */
export async function importBackup(
  db: Db,
  raw: unknown,
  actor: string
): Promise<ImportSummary> {
  const backup = validatedDbSchema.parse(raw)
  return db.transaction(async (tx) => {
    // Criteria history must agree version-by-version, or result references would point at different thresholds.
    const existing = new Map(
      (await listCriteriaVersions(tx)).map((v) => [v.version, v.id])
    )
    for (const v of backup.criteriaVersions) {
      const id = existing.get(v.version)
      if (id && id !== v.id)
        throw new AppError(
          "CONFLICT",
          `Criteria version ${v.version} in the backup differs from this database. Reset before importing.`
        )
      if (!id)
        await tx.insert(criteriaVersions).values({
          id: v.id,
          version: v.version,
          author: v.author,
          changeNote: v.changeNote,
          criteria: v.criteria,
          createdAt: new Date(v.createdAt),
        })
    }
    const summary: ImportSummary = {
      patients: 0,
      donors: 0,
      matches: 0,
      decisions: 0,
      skipped: 0,
    }
    summary.patients = await upsertPatients(tx, backup.patients, null)
    summary.donors = await upsertDonors(tx, backup.donors, null)

    // Records deleted in v1 survive only as snapshots: restore them as soft-deleted rows so FKs hold.
    const known = new Set([
      ...backup.patients.map((p) => p.id),
      ...backup.donors.map((d) => d.id),
    ])
    const now = new Date()
    for (const e of backup.evaluations) {
      if (!known.has(e.patientId))
        await upsertPatients(tx, [e.patientSnapshot], now)
      if (!known.has(e.donorId)) await upsertDonors(tx, [e.donorSnapshot], now)
      const [ph, dh] = await putSnapshots(tx, [
        { kind: "patient", data: e.patientSnapshot },
        { kind: "donor", data: e.donorSnapshot },
      ])
      const rows = await tx
        .insert(matchResults)
        .values({
          id: e.id,
          runId: null,
          source: "checked",
          patientId: e.patientId,
          donorId: e.donorId,
          patientName:
            `${e.patientSnapshot.identity.firstName} ${e.patientSnapshot.identity.lastName}`.trim(),
          donorCode: e.donorSnapshot.identity.donorId,
          patientSnapshot: ph,
          donorSnapshot: dh,
          criteriaVersionId: e.criteriaVersionId,
          engineVersion: e.result.engineVersion,
          pair: e.pair,
          result: e.result,
          overall: e.result.overall,
          blockerCount: e.result.blockers.length,
          missingCount: e.result.missingCount,
          screenKey: null,
          createdBy: e.createdBy || "Unspecified clinician",
          createdAt: new Date(e.createdAt),
        })
        .onConflictDoNothing()
        .returning({ id: matchResults.id })
      if (!rows.length) {
        summary.skipped++
        continue
      }
      summary.matches++
      if (e.decision) {
        await tx
          .insert(decisions)
          .values({
            id: `dec_${e.id}`,
            matchId: e.id,
            verdict: e.decision.verdict,
            clinician: e.decision.clinician,
            rationale: e.decision.rationale,
            reasons: e.decision.reasons,
            acknowledgedFindings: e.decision.acknowledgedFindings,
            decidedAt: new Date(e.decision.decidedAt),
          })
          .onConflictDoNothing()
        summary.decisions++
      }
    }
    for (const a of backup.audit)
      await tx
        .insert(auditLog)
        .values({
          id: a.id,
          at: new Date(a.at),
          actor: a.actor,
          action: LEGACY_AUDIT_ACTION[a.action] ?? a.action,
          subjectId: a.subjectId,
          summary: a.summary,
        })
        .onConflictDoNothing()
    await appendAudit(tx, {
      actor,
      action: "data.imported",
      subjectId: "backup",
      summary: `Imported ${summary.patients} patients, ${summary.donors} donors, ${summary.matches} match results`,
    })
    return summary
  })
}

export type BackupV2 = {
  format: "hla-trans.v2"
  exportedAt: string
  patients: Patient[]
  donors: Donor[]
  criteriaVersions: CriteriaVersion[]
  matches: Array<{
    id: string
    source: string
    patientId: string
    donorId: string
    createdAt: string
    overall: string
  }>
}

export async function exportAll(exec: Executor): Promise<BackupV2> {
  const [ps, ds, cv, ms] = await Promise.all([
    exec
      .select({ data: patients.data })
      .from(patients)
      .where(isNull(patients.deletedAt)),
    exec.select({ data: donors.data }).from(donors).where(isNull(donors.deletedAt)),
    listCriteriaVersions(exec),
    exec
      .select({
        id: matchResults.id,
        source: matchResults.source,
        patientId: matchResults.patientId,
        donorId: matchResults.donorId,
        createdAt: matchResults.createdAt,
        overall: matchResults.overall,
      })
      .from(matchResults),
  ])
  return {
    format: "hla-trans.v2",
    exportedAt: new Date().toISOString(),
    patients: ps.map((r) => r.data),
    donors: ds.map((r) => r.data),
    criteriaVersions: cv,
    matches: ms.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })),
  }
}

/** Audited wipe. TRUNCATE is the one path allowed past the immutability triggers. */
export async function resetAll(db: Db, actor: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`TRUNCATE decisions, match_results, match_runs, record_snapshots, audit_log, criteria_versions, patients, donors RESTART IDENTITY CASCADE`
    )
    await ensureInitialCriteria(tx)
    await appendAudit(tx, {
      actor,
      action: "data.reset",
      subjectId: "database",
      summary: "Reset database",
    })
  })
}

/** Loads the demo dataset (existing ids are kept) and queues a match run per available donor. */
export async function seedDemo(
  db: Db,
  actor: string
): Promise<{ patients: number; donors: number; runs: number }> {
  return db.transaction(async (tx) => {
    await ensureInitialCriteria(tx)
    const p = await upsertPatients(tx, DEMO_PATIENTS, null)
    const d = await upsertDonors(tx, DEMO_DONORS, null)
    let runs = 0
    for (const donor of DEMO_DONORS.filter(
      (x) => x.identity.state === "available"
    )) {
      await enqueueRun(tx, {
        subjectKind: "donor",
        subjectId: donor.id,
        subjectLabel: donor.identity.donorId,
        trigger: "seed",
        actor,
      })
      runs++
    }
    await appendAudit(tx, {
      actor,
      action: "data.seeded",
      subjectId: "demo",
      summary: `Loaded demo dataset (${p} patients, ${d} donors)`,
    })
    return { patients: p, donors: d, runs }
  })
}
