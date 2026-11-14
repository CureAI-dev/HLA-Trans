import { ageInYears } from "./calc"
import { parseIsoDate } from "./dates"
import { defaultPairInputs } from "./factories"
import { URGENCY_RANK } from "./options"
import { aboPriority, evaluateAbo } from "./rules/abo"
import { evaluateDonorHeart } from "./rules/donor-heart"
import { finding, worst } from "./rules/findings"
import { evaluateImmunology } from "./rules/immunology"
import { evaluateInfection } from "./rules/infection"
import { evaluateLogistics } from "./rules/logistics"
import { evaluateSize } from "./rules/size"
import type {
  Criteria,
  Donor,
  EvaluationResult,
  Finding,
  PairInputs,
  Patient,
} from "./schema"

export const ENGINE_VERSION = "1.0.0"

export function evaluate(input: {
  patient: Patient
  donor: Donor
  pair: PairInputs
  criteria: Criteria
  now?: Date
}): EvaluationResult {
  const ctx = { ...input, now: input.now ?? new Date() }
  const blockers: Array<Finding> = []
  if (input.patient.listing.state !== "active")
    blockers.push(
      finding({
        code: "blocker.patientState",
        status: "fail",
        title: "Candidate is not active on the waitlist",
        detail: "Activate the candidate before offer consideration.",
        evidence: input.patient.listing.state,
        source: "Candidate availability",
      })
    )
  if (input.donor.identity.state !== "available")
    blockers.push(
      finding({
        code: "blocker.donorState",
        status: "fail",
        title: "Donor is not available",
        detail: "Only available donors can be considered.",
        evidence: input.donor.identity.state,
        source: "Donor availability",
      })
    )
  const rules = [
    evaluateAbo(ctx),
    evaluateSize(ctx),
    evaluateImmunology(ctx),
    evaluateInfection(ctx),
    evaluateDonorHeart(ctx),
    evaluateLogistics(ctx),
  ]
  return {
    overall: worst([...blockers, ...rules]),
    blockers,
    rules,
    missingCount: rules.reduce(
      (sum, rule) => sum + rule.findings.filter((f) => f.missing).length,
      0
    ),
    engineVersion: ENGINE_VERSION,
  }
}

export type ScreenRow = {
  patient: Patient
  result: EvaluationResult
  aboPriority: "primary" | "secondary" | "incompatible"
  isPediatricCandidate: boolean
  /** Days at current urgency status; null when the relevant date is unavailable. */
  daysAtStatus: number | null
  /** True when duration used the listing date because status date was missing. */
  daysAtStatusFromListing: boolean
}

export function isPediatricCandidate(patient: Patient, now: Date): boolean {
  const listed = patient.listing.listingDate
  const date = listed === "" ? now : parseIsoDate(listed)
  const age =
    date === null ? null : ageInYears(patient.identity.dateOfBirth, date)
  return age !== null && age < 18
}

export function daysAtStatus(
  patient: Patient,
  now: Date
): { days: number | null; fromListing: boolean } {
  const { statusDate, listingDate } = patient.listing
  const fromListing = statusDate === "" && listingDate !== ""
  const date = parseIsoDate(statusDate || listingDate)
  const elapsed =
    date === null ? NaN : (now.getTime() - date.getTime()) / 86400000
  return {
    days: Number.isFinite(elapsed) && elapsed >= 0 ? Math.floor(elapsed) : null,
    fromListing,
  }
}

/** Screening order, not OPTN allocation. Pair times remain unrecorded until pair assessment. */
export function screenDonor(
  donor: Donor,
  patients: ReadonlyArray<Patient>,
  criteria: Criteria,
  now = new Date()
): Array<ScreenRow> {
  const rows = patients
    .filter((patient) => patient.listing.state === "active")
    .map((patient) => {
      const duration = daysAtStatus(patient, now)
      return {
        patient,
        result: evaluate({
          patient,
          donor,
          criteria,
          pair: defaultPairInputs(),
          now,
        }),
        aboPriority:
          donor.blood.abo === null || patient.blood.abo === null
            ? ("incompatible" as const)
            : aboPriority(donor.blood.abo, patient.blood.abo),
        isPediatricCandidate: isPediatricCandidate(patient, now),
        daysAtStatus: duration.days,
        daysAtStatusFromListing: duration.fromListing,
      }
    })
  const outcomeRank = { pass: 0, review: 1, fail: 2 }
  const bloodRank = { primary: 0, secondary: 1, incompatible: 2 }
  const pediatricDonor =
    donor.identity.ageYears !== null && donor.identity.ageYears < 18
  const urgency = (row: ScreenRow) =>
    row.patient.listing.urgencyStatus === null
      ? Number.POSITIVE_INFINITY
      : URGENCY_RANK[row.patient.listing.urgencyStatus]
  rows.sort((a, b) => {
    const outcome =
      outcomeRank[a.result.overall] - outcomeRank[b.result.overall]
    if (outcome) return outcome
    const rank = urgency(a) - urgency(b)
    if (rank) return rank
    if (pediatricDonor && a.isPediatricCandidate !== b.isPediatricCandidate)
      return a.isPediatricCandidate ? -1 : 1
    const blood = bloodRank[a.aboPriority] - bloodRank[b.aboPriority]
    if (blood) return blood
    if (a.daysAtStatus === null && b.daysAtStatus !== null) return 1
    if (b.daysAtStatus === null && a.daysAtStatus !== null) return -1
    if (
      a.daysAtStatus !== null &&
      b.daysAtStatus !== null &&
      a.daysAtStatus !== b.daysAtStatus
    )
      return b.daysAtStatus - a.daysAtStatus
    return a.patient.id < b.patient.id
      ? -1
      : a.patient.id > b.patient.id
        ? 1
        : 0
  })
  return rows
}
