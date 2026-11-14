import { afterEach, expect, test, vi } from "vitest"
import { DEFAULT_CRITERIA } from "../criteria"
import * as factories from "../factories"
import {
  daysAtStatus,
  evaluate,
  isPediatricCandidate,
  screenDonor,
} from "../engine"
import { DONOR_TEST_VALUES } from "../options"
import { evaluationResultSchema } from "../schema"
import type { Donor, Patient } from "../schema"
import { donor, patient } from "./builders"

const now = new Date("2026-11-14T00:00:00Z")
const criteria = DEFAULT_CRITERIA
const completePair = {
  ...factories.defaultPairInputs(),
  procurementMinutes: 30,
  transportMinutes: 120,
  implantMinutes: 30,
}
afterEach(() => vi.restoreAllMocks())

function completePatient(id = "p"): Patient {
  return patient({
    id,
    identity: { dateOfBirth: "1980-01-01" },
    listing: {
      state: "active",
      urgencyStatus: "A3",
      listingDate: "2026-01-01",
      statusDate: "2026-10-01",
    },
    blood: { abo: "O", verifiedTwoSamples: true },
    body: { heightCm: 175, weightKg: 75 },
    history: { priorSternotomies: 0 },
    sensitization: { cpra: 0 },
    hemodynamics: { paMean: 20, pcwp: 10, cardiacOutput: 5 },
    serology: { cmvIgG: "negative", ebvIgG: "negative", toxoIgG: "negative" },
  })
}

function completeDonor(): Donor {
  const d = donor({
    identity: { ageYears: 35 },
    blood: { abo: "O", verifiedTwoSamples: true },
    body: { heightCm: 175, weightKg: 75 },
    echo: {
      lvef: 60,
      septumMm: 10,
      posteriorWallMm: 10,
      wallMotion: "normal",
      valveDisease: "none",
      rvFunction: "normal",
      congenitalAbnormality: "no",
    },
    history: {
      diabetes: "no",
      cigarettesOver20PackYears: "no",
      cocaine: "no",
      knownCad: "no",
      priorMi: "no",
      priorCardiacSurgery: "no",
      malignancyRisk: "none",
      bornInChagasEndemicCountry: "no",
    },
    coronary: { angiography: "normal", coronaryAnomaly: "no" },
    ecg: { lvhCriteria: "no" },
    death: { cardiacArrest: "no" },
    labs: { sodiumPeak: 140, sodiumLatest: 140, troponinIPeak: 0.1 },
    infection: {
      sampleDrawnWithin96h: true,
      bloodCulturePositive: "no",
      cnsInfection: "none",
    },
  })
  for (const key of DONOR_TEST_VALUES) d.infection.serology[key] = "negative"
  return d
}

function run(p = completePatient(), d = completeDonor()) {
  return evaluate({ patient: p, donor: d, pair: completePair, criteria, now })
}

function ordered(patients: Array<Patient>, d = completeDonor()) {
  const rows = screenDonor(d, patients, criteria, now)
  // The public screening API intentionally has no pair timing inputs. Only logistics should need review.
  for (const row of rows) {
    expect(row.result.overall).toBe("review")
    expect(
      row.result.rules.filter((r) => r.status !== "pass").map((r) => r.rule)
    ).toEqual(["logistics"])
    expect(run(row.patient, d).overall).toBe("pass")
  }
  return rows.map((row) => row.patient.id)
}

test("complete fixture passes all rules and validates the result contract", () => {
  const result = run()
  expect(result.overall).toBe("pass")
  expect(result.rules).toHaveLength(6)
  expect(result.engineVersion).toBe("1.0.0")
  expect(evaluationResultSchema.safeParse(result).success).toBe(true)
})

test("inactive patient and unavailable donor produce explicit blockers", () => {
  const p = completePatient()
  p.listing.state = "inactive"
  expect(run(p)).toMatchObject({
    overall: "fail",
    blockers: [
      expect.objectContaining({ code: "blocker.patientState", status: "fail" }),
    ],
  })
  const d = completeDonor()
  d.identity.state = "closed"
  expect(run(completePatient(), d)).toMatchObject({
    overall: "fail",
    blockers: [
      expect.objectContaining({ code: "blocker.donorState", status: "fail" }),
    ],
  })
})

test("overall is worst rule and missingCount counts findings across rules", () => {
  const p = completePatient()
  p.body.weightKg = null
  p.blood.abo = null
  const result = evaluate({
    patient: p,
    donor: completeDonor(),
    pair: factories.defaultPairInputs(),
    criteria,
    now,
  })
  expect(result.overall).toBe("review")
  expect(result.missingCount).toBe(
    result.rules.flatMap((r) => r.findings).filter((f) => f.missing).length
  )
  expect(result.missingCount).toBeGreaterThan(0)
  const d = completeDonor()
  d.echo.lvef = 10
  expect(run(completePatient(), d).overall).toBe("fail")
})

test("urgency outranks adult age", () => {
  const urgent = completePatient("urgent")
  urgent.identity.dateOfBirth = "1966-01-01"
  urgent.listing.urgencyStatus = "A1"
  const young = completePatient("young")
  young.identity.dateOfBirth = "2006-01-01"
  young.listing.urgencyStatus = "A4"
  expect(ordered([young, urgent])).toEqual(["urgent", "young"])
})

test("adult donor has no pediatric preference: ABO then status duration", () => {
  const child = completePatient("child")
  child.identity.dateOfBirth = "2010-01-01"
  child.listing.urgencyStatus = "P1B"
  child.blood.abo = "A"
  const adult = completePatient("adult")
  adult.blood.abo = "B"
  expect(ordered([child, adult])).toEqual(["adult", "child"])
  child.blood.abo = "B"
  adult.listing.statusDate = "2026-09-01"
  expect(ordered([child, adult])).toEqual(["adult", "child"])
})

test("pediatric donor prefers listed pediatric candidate at equal urgency before ABO", () => {
  const child = completePatient("child")
  child.identity.dateOfBirth = "2010-01-01"
  child.listing.urgencyStatus = "P1B"
  child.blood.abo = "A"
  const adult = completePatient("adult")
  adult.blood.abo = "B"
  const d = completeDonor()
  d.identity.ageYears = 15
  expect(ordered([adult, child], d)).toEqual(["child", "adult"])
})

test("primary ABO before secondary; 90 status days before 10; stable id last", () => {
  const a = completePatient("a")
  const b = completePatient("b")
  a.blood.abo = "A"
  b.blood.abo = "B"
  expect(ordered([a, b])).toEqual(["b", "a"])
  a.blood.abo = "B"
  a.listing.statusDate = "2026-11-04"
  b.listing.statusDate = "2026-08-16"
  expect(ordered([a, b])).toEqual(["b", "a"])
  a.listing.statusDate = b.listing.statusDate
  expect(ordered([b, a])).toEqual(["a", "b"])
})

test("missing urgency and duration sort last, inactive patients excluded", () => {
  const dated = completePatient("dated")
  const missing = completePatient("missing")
  missing.listing.statusDate = ""
  missing.listing.listingDate = ""
  expect(ordered([missing, dated])).toEqual(["dated", "missing"])
  missing.listing.urgencyStatus = null
  expect(ordered([missing, dated])).toEqual(["dated", "missing"])
  missing.listing.state = "inactive"
  expect(ordered([missing, dated])).toEqual(["dated"])
})

test("PASS outranks higher urgency REVIEW through actual screening and all real rules", () => {
  // Pair injection is scoped to this test because screenDonor deliberately defaults to unrecorded times.
  vi.spyOn(factories, "defaultPairInputs").mockReturnValue(completePair)
  const pass = completePatient("pass")
  pass.listing.urgencyStatus = "A4"
  const review = completePatient("review")
  review.listing.urgencyStatus = "A1"
  review.blood.verifiedTwoSamples = false
  const rows = screenDonor(completeDonor(), [review, pass], criteria, now)
  expect(rows.map((row) => [row.patient.id, row.result.overall])).toEqual([
    ["pass", "pass"],
    ["review", "review"],
  ])
})

test("listing age defines eligibility separately from current age", () => {
  const p = completePatient()
  p.identity.dateOfBirth = "2007-01-01"
  p.listing.listingDate = "2024-06-01"
  expect(isPediatricCandidate(p, now)).toBe(true)
  const size = run(p).rules.find((rule) => rule.rule === "size")
  expect(size?.findings).toContainEqual(
    expect.objectContaining({ code: "size.phm", status: "pass" })
  )
  expect(size?.findings).not.toContainEqual(
    expect.objectContaining({ title: "Pediatric weight match" })
  )
  p.listing.listingDate = "2025-01-01"
  expect(isPediatricCandidate(p, now)).toBe(false)
  p.identity.dateOfBirth = "2010-01-01"
  p.listing.listingDate = ""
  expect(isPediatricCandidate(p, now)).toBe(true)
  p.identity.dateOfBirth = ""
  expect(isPediatricCandidate(p, now)).toBe(false)
})

test("status duration flags listing fallback and preserves missing or invalid dates", () => {
  const p = completePatient()
  p.listing.statusDate = ""
  p.listing.listingDate = "2026-11-04"
  expect(daysAtStatus(p, now)).toEqual({ days: 10, fromListing: true })
  expect(screenDonor(completeDonor(), [p], criteria, now)[0]).toMatchObject({
    daysAtStatus: 10,
    daysAtStatusFromListing: true,
  })
  p.listing.listingDate = ""
  expect(daysAtStatus(p, now)).toEqual({ days: null, fromListing: false })
  p.listing.statusDate = "2026-11-15"
  expect(daysAtStatus(p, now).days).toBeNull()
})

test("200 active patients screen in under 1000ms without mutating input order", () => {
  const patients = Array.from({ length: 200 }, (_, i) =>
    completePatient(String(200 - i))
  )
  const ids = patients.map((p) => p.id)
  const start = performance.now()
  expect(screenDonor(completeDonor(), patients, criteria, now)).toHaveLength(
    200
  )
  expect(performance.now() - start).toBeLessThan(1000)
  expect(patients.map((p) => p.id)).toEqual(ids)
})
