import { demoDonors, demoPatients } from "@/domain/demo-data"
import { demoNow } from "@/domain/demo-data/people"
import { DEFAULT_CRITERIA } from "@/domain/criteria"
import { evaluate, screenDonor } from "@/domain/engine"
import { defaultPairInputs } from "@/domain/factories"
import type { MatchDetail, MatchRow, RunRow } from "@/domain/match-types"
import type { Donor, PairInputs, Patient } from "@/domain/schema"

/**
 * Demo records for the practice screens. Everything is worked out in the browser by the real
 * engine with the default criteria. Nothing here reads or writes the database.
 */
export const PRACTICE_CRITERIA = { version: 1, criteria: DEFAULT_CRITERIA }
export const PRACTICE_PATIENT_ID = "demo-patient-01"
export const PRACTICE_DONOR_ID = "demo-donor-01"

/** The four values the first tutorial asks for. */
export const PRACTICE_VALUES = {
  distanceNm: 180,
  procurementMinutes: 40,
  transportMinutes: 90,
  implantMinutes: 60,
} as const satisfies Partial<PairInputs>

function find<T extends { id: string }>(records: ReadonlyArray<T>, id: string) {
  const record = records.find((r) => r.id === id)
  if (!record) throw new Error(`Practice record ${id} is missing`)
  return record
}

export const practicePair = (): { patient: Patient; donor: Donor } => ({
  patient: find(demoPatients(), PRACTICE_PATIENT_ID),
  donor: find(demoDonors(), PRACTICE_DONOR_ID),
})

const fullName = (p: Patient) =>
  `${p.identity.firstName} ${p.identity.lastName}`.trim()
const stamp = () => demoNow().toISOString()

function toRow(
  patient: Patient,
  donor: Donor,
  pair: PairInputs = defaultPairInputs()
): MatchRow {
  const result = evaluate({
    patient,
    donor,
    pair,
    criteria: DEFAULT_CRITERIA,
    now: demoNow(),
  })
  return {
    id: `practice-${patient.id}-${donor.id}`,
    source: "screening",
    runId: "practice",
    patientId: patient.id,
    donorId: donor.id,
    patientName: fullName(patient),
    donorCode: donor.identity.donorId,
    overall: result.overall,
    blockerCount: result.blockers.length,
    missingCount: result.rules
      .flatMap((r) => r.findings)
      .filter((f) => f.missing).length,
    criteriaVersion: PRACTICE_CRITERIA.version,
    decision: null,
    outOfDate: false,
    createdAt: stamp(),
  }
}

/** Every active demo patient compared with the practice donor, in screening order. */
export function practiceScreening(): Array<MatchRow> {
  const { donor } = practicePair()
  const active = demoPatients().filter((p) => p.listing.state === "active")
  return screenDonor(donor, active, DEFAULT_CRITERIA, demoNow()).map((row) =>
    toRow(row.patient, donor)
  )
}

/** The practice patient compared with every available demo donor. */
export function practicePatientRows(): Array<MatchRow> {
  const { patient } = practicePair()
  return demoDonors()
    .filter((d) => d.identity.state === "available")
    .map((donor) => toRow(patient, donor))
}

export function practiceRun(kind: "patient" | "donor"): RunRow {
  const { patient, donor } = practicePair()
  const rows = kind === "donor" ? practiceScreening() : practicePatientRows()
  const count = (o: MatchRow["overall"]) =>
    rows.filter((r) => r.overall === o).length
  const started = demoNow()
  return {
    id: "practice",
    trigger: kind === "donor" ? "donor.created" : "patient.created",
    subjectKind: kind,
    subjectId: kind === "donor" ? donor.id : patient.id,
    subjectLabel: kind === "donor" ? donor.identity.donorId : fullName(patient),
    criteriaVersion: PRACTICE_CRITERIA.version,
    status: "succeeded",
    total: rows.length,
    processed: rows.length,
    passCount: count("pass"),
    reviewCount: count("review"),
    failCount: count("fail"),
    error: null,
    cancelRequested: false,
    createdBy: "Practice",
    createdAt: started.toISOString(),
    startedAt: started.toISOString(),
    finishedAt: new Date(started.getTime() + 6_000).toISOString(),
  }
}

/** Screening: blank pair inputs. Checked: 250 minutes in total, which needs a review. */
export function practiceMatch(
  mode: "screening" | "checked",
  outOfDate = false
): MatchDetail {
  const { patient, donor } = practicePair()
  const pair: PairInputs =
    mode === "screening"
      ? defaultPairInputs()
      : { ...defaultPairInputs(), ...PRACTICE_VALUES, transportMinutes: 150 }
  return {
    id: "practice",
    source: mode,
    runId: mode === "screening" ? "practice" : null,
    createdAt: stamp(),
    createdBy: "Practice",
    patientId: patient.id,
    donorId: donor.id,
    patient,
    donor,
    criteriaVersionId: "practice",
    criteriaVersion: PRACTICE_CRITERIA.version,
    criteria: DEFAULT_CRITERIA,
    pair,
    result: evaluate({
      patient,
      donor,
      pair,
      criteria: DEFAULT_CRITERIA,
      now: demoNow(),
    }),
    decision: null,
    outOfDate,
  }
}

/** What the first tutorial says after the four values are filled in. */
export function explainResult(input: {
  minutes: number
  distanceNm: number
  overall: string
}): { title: string; text: string } {
  const { minutes, distanceNm, overall } = input
  const { ischemicPassMaxMinutes: pass, ischemicReviewMaxMinutes: review } =
    DEFAULT_CRITERIA.logistics
  const maxDistance = practicePair().patient.acceptance.maxDistanceNm
  const sum = `The three times add up to <b>${minutes} minutes</b>.`
  const meaning =
    "This is how long the heart is expected to be without blood flow."
  const one =
    "One value outside its limit is enough to make the whole pair FAIL."
  if (overall === "pass")
    return {
      title: "REVIEW became PASS",
      text: `${sum} This is the estimated cold ischemic time. It means how long the heart is expected to be without blood flow. Up to ${pass} minutes is a PASS, so the result changed from REVIEW to PASS while you typed.`,
    }
  if (overall === "fail")
    return {
      title: "Your numbers made the pair FAIL",
      text:
        maxDistance !== null && distanceNm > maxDistance
          ? `You typed a distance of <b>${distanceNm} NM</b>. The longest distance accepted for Maya is ${maxDistance} NM. ${one}`
          : `${sum} ${meaning} More than ${review} minutes is a FAIL. ${one}`,
    }
  return {
    title: "The pair is still REVIEW",
    text: `${sum} ${meaning} Up to ${pass} minutes is a PASS. From ${pass + 1} to ${review} minutes, Concord asks a clinician to look, so the result stays REVIEW.`,
  }
}
