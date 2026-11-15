import type {
  AuditAction as LegacyAuditAction,
  Criteria,
  Decision,
  Donor,
  EvaluationResult,
  Outcome,
  PairInputs,
  Patient,
} from "./schema"

export type AuditAction =
  | Exclude<LegacyAuditAction, "evaluation.created" | "evaluation.decided">
  | "match.checked"
  | "match.decided"
  | "match_run.queued"
  | "match_run.succeeded"
  | "match_run.failed"
  | "match_run.cancelled"

export const LEGACY_AUDIT_ACTION: Partial<
  Record<LegacyAuditAction, AuditAction>
> = {
  "evaluation.created": "match.checked",
  "evaluation.decided": "match.decided",
}

export type PatientRow = {
  id: string
  version: number
  mrn: string
  fullName: string
  dateOfBirth: string
  listingState: Patient["listing"]["state"]
  listingDate: string
  urgencyStatus: Patient["listing"]["urgencyStatus"]
  abo: Patient["blood"]["abo"]
  device: string | null
  cpra: number | null
  updatedAt: string
}

export type DonorRow = {
  id: string
  version: number
  donorCode: string
  state: Donor["identity"]["state"]
  abo: Donor["blood"]["abo"]
  donationType: Donor["donation"]["type"]
  ageYears: number | null
  hospital: string
  updatedAt: string
}

export type Versioned<T> = { record: T; version: number }

export type RunStatus =
  "queued" | "running" | "succeeded" | "failed" | "cancelled"
export type RunTrigger = "donor.created" | "patient.created" | "manual" | "seed"

export type RunRow = {
  id: string
  trigger: RunTrigger
  subjectKind: "patient" | "donor"
  subjectId: string
  subjectLabel: string
  criteriaVersion: number
  status: RunStatus
  total: number | null
  processed: number
  passCount: number
  reviewCount: number
  failCount: number
  error: string | null
  cancelRequested: boolean
  createdBy: string
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
}

export type MatchRow = {
  id: string
  source: "screening" | "checked"
  runId: string | null
  patientId: string
  donorId: string
  patientName: string
  donorCode: string
  overall: Outcome
  blockerCount: number
  missingCount: number
  criteriaVersion: number
  decision: Decision["verdict"] | null
  /** Record or criteria changed since this result was computed. */
  outOfDate: boolean
  createdAt: string
}

export type MatchDetail = {
  id: string
  source: "screening" | "checked"
  runId: string | null
  createdAt: string
  createdBy: string
  patientId: string
  donorId: string
  patient: Patient
  donor: Donor
  criteriaVersionId: string
  criteriaVersion: number
  criteria: Criteria
  pair: PairInputs
  result: EvaluationResult
  decision: Decision | null
  outOfDate: boolean
}
