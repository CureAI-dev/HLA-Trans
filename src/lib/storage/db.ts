import { useSyncExternalStore } from "react"
import { DEFAULT_CRITERIA, validateCriteria } from "../../domain/criteria"
import { evaluate } from "../../domain/engine"
import { SAMPLE_DONORS, SAMPLE_PATIENTS } from "../../domain/sample-data"
import {
  criteriaSchema,
  decisionSchema,
  donorSchema,
  pairInputsSchema,
  patientSchema,
} from "../../domain/schema"
import type {
  AuditAction,
  Criteria,
  CriteriaVersion,
  Db,
  Decision,
  Donor,
  Evaluation,
  PairInputs,
  Patient,
} from "../../domain/schema"
import { createLocalStore, StorageWriteError } from "./local-store"
import { validatedDbSchema } from "./validated-db-schema"

export const DB_KEY = "hla-trans.db.v1"
export class DbActionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "DbActionError"
  }
}
const id = () => crypto.randomUUID()
const now = () => new Date().toISOString()
export function initialDb(): Db {
  return {
    schemaVersion: 1,
    clinicianName: "",
    patients: [],
    donors: [],
    evaluations: [],
    audit: [],
    criteriaVersions: [
      {
        id: "criteria-v1",
        version: 1,
        createdAt: now(),
        author: "System",
        changeNote: "Initial default criteria",
        criteria: structuredClone(DEFAULT_CRITERIA),
      },
    ],
  }
}
export const dbStore = createLocalStore({
  key: DB_KEY,
  schema: validatedDbSchema,
  initial: initialDb,
})
function current(): Db {
  const db = dbStore.get()
  if (!db) throw new StorageWriteError("Storage is unavailable.")
  return db
}
export function useDb(): Db {
  return useSyncExternalStore(dbStore.subscribe, current, current)
}
export function latestCriteria(db: Db): CriteriaVersion {
  return db.criteriaVersions.reduce((latest, version) =>
    version.version > latest.version ? version : latest
  )
}
function domain<T>(fn: () => T): T {
  try {
    return fn()
  } catch (error) {
    if (error instanceof StorageWriteError || error instanceof DbActionError)
      throw error
    throw new DbActionError(
      error instanceof Error
        ? error.message
        : "The requested action could not be completed."
    )
  }
}
function commit(
  action: AuditAction,
  subjectId: string,
  summary: string,
  mutate: (db: Db) => void
): Db {
  return domain(() =>
    dbStore.update((db) => {
      const actor = db.clinicianName || "Unspecified clinician"
      mutate(db)
      db.audit.push({
        id: id(),
        at: now(),
        actor,
        action,
        subjectId,
        summary,
      })
      return db
    })
  )
}
export const actions = {
  setClinician(name: string): void {
    domain(() =>
      dbStore.update((db) => ({ ...db, clinicianName: name.trim() }))
    )
  },
  savePatient(p: Patient): Patient {
    return domain(() => {
      const record = patientSchema.parse({ ...p, updatedAt: now() })
      const exists = current().patients.some((item) => item.id === record.id)
      const db = commit(
        exists ? "patient.updated" : "patient.created",
        record.id,
        "Saved candidate record",
        (draft) => {
          draft.patients = [
            ...draft.patients.filter((item) => item.id !== record.id),
            record,
          ]
        }
      )
      return db.patients.find((item) => item.id === record.id)!
    })
  },
  deletePatient(patientId: string): void {
    if (!current().patients.some((p) => p.id === patientId))
      throw new DbActionError("Candidate not found.")
    commit(
      "patient.deleted",
      patientId,
      "Deleted candidate; evaluation snapshots retained",
      (db) => {
        db.patients = db.patients.filter((p) => p.id !== patientId)
      }
    )
  },
  saveDonor(d: Donor): Donor {
    return domain(() => {
      const record = donorSchema.parse({ ...d, updatedAt: now() })
      const exists = current().donors.some((item) => item.id === record.id)
      const db = commit(
        exists ? "donor.updated" : "donor.created",
        record.id,
        "Saved donor record",
        (draft) => {
          draft.donors = [
            ...draft.donors.filter((item) => item.id !== record.id),
            record,
          ]
        }
      )
      return db.donors.find((item) => item.id === record.id)!
    })
  },
  deleteDonor(donorId: string): void {
    if (!current().donors.some((d) => d.id === donorId))
      throw new DbActionError("Donor not found.")
    commit(
      "donor.deleted",
      donorId,
      "Deleted donor; evaluation snapshots retained",
      (db) => {
        db.donors = db.donors.filter((d) => d.id !== donorId)
      }
    )
  },
  createEvaluation(
    patientId: string,
    donorId: string,
    pair: PairInputs
  ): Evaluation {
    return domain(() => {
      const db = current(),
        patient = db.patients.find((p) => p.id === patientId),
        donor = db.donors.find((d) => d.id === donorId)
      if (!patient || !donor)
        throw new DbActionError("Candidate or donor not found.")
      const criteria = latestCriteria(db),
        inputs = pairInputsSchema.parse(pair)
      const record: Evaluation = {
        id: id(),
        createdAt: now(),
        createdBy: db.clinicianName,
        patientId,
        donorId,
        patientSnapshot: structuredClone(patient),
        donorSnapshot: structuredClone(donor),
        criteriaVersionId: criteria.id,
        criteriaVersion: criteria.version,
        criteriaSnapshot: structuredClone(criteria.criteria),
        pair: inputs,
        result: evaluate({
          patient,
          donor,
          pair: inputs,
          criteria: criteria.criteria,
        }),
        decision: null,
      }
      return commit(
        "evaluation.created",
        record.id,
        "Created compatibility evaluation",
        (draft) => {
          draft.evaluations.push(record)
        }
      ).evaluations.find((e) => e.id === record.id)!
    })
  },
  decide(
    evaluationId: string,
    decision: Omit<Decision, "decidedAt">
  ): Evaluation {
    return domain(() => {
      const evaluation = current().evaluations.find(
        (e) => e.id === evaluationId
      )
      if (!evaluation) throw new DbActionError("Evaluation not found.")
      if (evaluation.decision)
        throw new DbActionError("This evaluation already has a final decision.")
      const record = decisionSchema.parse({
        ...decision,
        clinician: decision.clinician.trim(),
        rationale: decision.rationale.trim(),
        decidedAt: now(),
      })
      if (record.verdict === "decline" && record.reasons.length === 0)
        throw new DbActionError("Select at least one decline reason.")
      const findings = [
        ...evaluation.result.blockers,
        ...evaluation.result.rules.flatMap((rule) => rule.findings),
      ]
      if (
        (evaluation.result.overall !== "pass" ||
          findings.some((f) => f.status === "fail" || f.status === "review")) &&
        !record.acknowledgedFindings
      )
        throw new DbActionError(
          "Acknowledge all FAIL and REVIEW findings before recording a decision."
        )
      return commit(
        "evaluation.decided",
        evaluationId,
        `Recorded ${record.verdict} decision`,
        (db) => {
          db.evaluations.find((e) => e.id === evaluationId)!.decision = record
        }
      ).evaluations.find((e) => e.id === evaluationId)!
    })
  },
  publishCriteria(criteria: Criteria, changeNote: string): CriteriaVersion {
    return domain(() => {
      const parsed = criteriaSchema.parse(criteria),
        issues = validateCriteria(parsed)
      if (issues.length)
        throw new DbActionError(
          issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")
        )
      const db = current(),
        record = {
          id: id(),
          version: latestCriteria(db).version + 1,
          createdAt: now(),
          author: db.clinicianName,
          changeNote,
          criteria: parsed,
        }
      return commit(
        "criteria.published",
        record.id,
        "Published criteria version",
        (draft) => {
          draft.criteriaVersions.push(record)
        }
      ).criteriaVersions.find((c) => c.id === record.id)!
    })
  },
  importDb(raw: unknown): {
    patients: number
    donors: number
    evaluations: number
  } {
    return domain(() => {
      const parsed = validatedDbSchema.parse(raw)
      parsed.audit.push({
        id: id(),
        at: now(),
        actor: current().clinicianName || "Unspecified clinician",
        action: "data.imported",
        subjectId: DB_KEY,
        summary: "Imported database backup",
      })
      dbStore.set(parsed)
      return {
        patients: parsed.patients.length,
        donors: parsed.donors.length,
        evaluations: parsed.evaluations.length,
      }
    })
  },
  exportDb(): string {
    return JSON.stringify(current(), null, 2)
  },
  loadSampleData(): void {
    commit("data.seeded", DB_KEY, "Loaded fictional sample records", (db) => {
      db.patients.push(
        ...SAMPLE_PATIENTS.filter(
          (p) => !db.patients.some((existing) => existing.id === p.id)
        )
      )
      db.donors.push(
        ...SAMPLE_DONORS.filter(
          (d) => !db.donors.some((existing) => existing.id === d.id)
        )
      )
    })
  },
  reset(): void {
    commit("data.reset", DB_KEY, "Reset local database", (db) => {
      Object.assign(db, initialDb())
    })
  },
}
