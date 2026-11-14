import { emptyDonor, emptyPatient, defaultPairInputs } from "./factories"
import { DONOR_TEST_VALUES, RECIPIENT_TEST_VALUES } from "./options"
import type { Donor, Patient, PairInputs, Outcome } from "./schema"

/** All records are fictional teaching examples, never clinical recommendations. */
export const SAMPLE_NOW = new Date("2026-11-14T12:00:00.000Z")
const date = "2026-11-13"

function patient(index: number): Patient {
  const p = emptyPatient(SAMPLE_NOW)
  p.id = `sample-patient-${index}`
  Object.assign(p.identity, {
    mrn: `FICTIONAL-${index}`,
    firstName: "Fictional",
    lastName: `Candidate ${index}`,
    dateOfBirth: "1980-04-08",
    transplantCenter: "Fictional Teaching Center",
  })
  Object.assign(p.listing, {
    state: "active",
    listingDate: "2026-10-01",
    urgencyStatus: "A1",
    statusDate: date,
  })
  p.body = { heightCm: 175, weightKg: 75 }
  Object.assign(p.blood, { abo: "O", verifiedTwoSamples: true })
  Object.assign(p.hemodynamics, {
    catheterizationDate: date,
    paMean: 25,
    pcwp: 15,
    cardiacOutput: 5,
  })
  p.history.priorSternotomies = 0
  Object.assign(p.sensitization, { cpra: 0, cpraPeak: 0, cpraDate: date })
  for (const test of RECIPIENT_TEST_VALUES) p.serology[test] = "negative"
  p.serologyDate = date
  p.notes = "FICTIONAL teaching candidate. No real patient information."
  return p
}

export const SAMPLE_PATIENTS: Patient[] = Array.from({ length: 6 }, (_, i) =>
  patient(i + 1)
)
SAMPLE_PATIENTS[0].support.device = "va_ecmo"
const sensitized = SAMPLE_PATIENTS[1]
sensitized.listing.urgencyStatus = "A2"
sensitized.support.device = "iabp"
sensitized.blood.abo = "A"
Object.assign(sensitized.sensitization, {
  cpra: 78,
  cpraPeak: 78,
  unacceptableAntigens: ["A9"],
  antibodies: [
    {
      id: "sample-antibody-a24",
      antigen: "A24",
      mfi: 8000,
      c1q: "negative",
      testDate: date,
    },
    {
      id: "sample-antibody-b62",
      antigen: "B62",
      mfi: 3500,
      c1q: "negative",
      testDate: date,
    },
  ],
})
const lvad = SAMPLE_PATIENTS[2]
lvad.listing.urgencyStatus = "A3"
lvad.support.device = "lvad_durable"
lvad.blood.abo = "B"
lvad.history.priorSternotomies = 1
lvad.acceptance.acceptHcvNat = true
const amyloid = SAMPLE_PATIENTS[3]
amyloid.listing.urgencyStatus = "A4"
amyloid.blood.abo = "AB"
amyloid.diagnosis.primary = "1051"
Object.assign(amyloid.hemodynamics, { paMean: 39, pcwp: 15, cardiacOutput: 5 }) // PVR 4.8 WU
const infant = SAMPLE_PATIENTS[4]
infant.identity.dateOfBirth = "2026-04-08" // Approximately 0.6 years at SAMPLE_NOW.
infant.listing.urgencyStatus = "P1A"
infant.body = { heightCm: 68, weightKg: 8 }
Object.assign(infant.blood, {
  abo: "B",
  acceptsIncompatible: true,
  antiATiter: 4,
  antiBTiter: 4,
  titerDate: date,
})
SAMPLE_PATIENTS[5].listing.state = "inactive"
SAMPLE_PATIENTS[5].listing.urgencyStatus = "A6"
SAMPLE_PATIENTS[5].acceptance.maxDonorAge = 40

function donor(index: number): Donor {
  const d = emptyDonor(SAMPLE_NOW)
  d.id = `sample-donor-${index}`
  Object.assign(d.identity, {
    donorId: `FICTIONAL-D${index}`,
    ageYears: 28,
    donorHospital: "Fictional Teaching Hospital",
    opo: "Fictional OPO",
    referralDate: date,
  })
  d.body = { heightCm: 175, weightKg: 75 }
  Object.assign(d.blood, { abo: "O", verifiedTwoSamples: true })
  d.death.cardiacArrest = "no"
  Object.assign(d.history, {
    hypertension: "no",
    diabetes: "no",
    cigarettesOver20PackYears: "no",
    cocaine: "no",
    amphetamines: "no",
    ivDrugUse: "no",
    heavyAlcohol: "no",
    priorMi: "no",
    knownCad: "no",
    priorCardiacSurgery: "no",
    malignancyRisk: "none",
    bornInChagasEndemicCountry: "no",
  })
  Object.assign(d.echo, {
    echoDate: date,
    lvef: 60,
    septumMm: 10,
    posteriorWallMm: 10,
    wallMotion: "normal",
    valveDisease: "none",
    rvFunction: "normal",
    congenitalAbnormality: "no",
  })
  Object.assign(d.coronary, {
    angiography: "normal",
    vesselsOver50: 0,
    coronaryAnomaly: "no",
  })
  Object.assign(d.ecg, {
    lvhCriteria: "no",
    ischemicChanges: "no",
    significantArrhythmia: "no",
  })
  Object.assign(d.labs, {
    sodiumPeak: 145,
    sodiumLatest: 140,
    troponinIPeak: 0.1,
  })
  for (const test of DONOR_TEST_VALUES) d.infection.serology[test] = "negative"
  Object.assign(d.infection, {
    sampleDrawnWithin96h: true,
    bloodCulturePositive: "no",
    cnsInfection: "none",
    chestXray: "normal",
  })
  Object.assign(d.hla, {
    A: ["A2", "A3"],
    B: ["B7", "B8"],
    C: ["C7", "C8"],
    DRB1: ["DR1", "DR4"],
    DRB345: ["DR51", "DR53"],
    DQA1: ["DQA1*01:01", "DQA1*03:01"],
    DQB1: ["DQ5", "DQ8"],
    DPA1: ["DPA1*01:03", "DPA1*02:01"],
    DPB1: ["DPB1*04:01", "DPB1*04:02"],
    bw4: "no",
    bw6: "yes",
    typingDate: date,
  })
  d.notes = "FICTIONAL teaching donor. No real donor information."
  return d
}
export const SAMPLE_DONORS: Donor[] = Array.from({ length: 5 }, (_, i) =>
  donor(i + 1)
)
const extended = SAMPLE_DONORS[1]
Object.assign(extended.identity, { ageYears: 52, sex: "female" })
extended.blood.abo = "A"
extended.echo.lvef = 45
extended.history.knownCad = "yes"
Object.assign(extended.coronary, { angiography: "abnormal", vesselsOver50: 1 })
extended.hla.A = ["A24", "A2"]
const hcv = SAMPLE_DONORS[2]
hcv.identity.ageYears = 34
hcv.blood.abo = "B"
hcv.infection.serology.hcvNat = "positive"
hcv.infection.serology.antiHcv = "positive"
const dcd = SAMPLE_DONORS[3]
dcd.identity.ageYears = 31
Object.assign(dcd.donation, {
  type: "dcd",
  dcdRecovery: "ta_nrp",
  functionalWarmIschemiaMinutes: 24,
  agonalPhaseMinutes: 30,
  noTouchMinutes: 5,
})
const co = SAMPLE_DONORS[4]
co.identity.ageYears = 46
co.blood.abo = "A"
Object.assign(co.death, {
  carbonMonoxidePoisoning: true,
  carboxyhemoglobinPct: 22,
})
co.labs.troponinIPeak = 0.4

function sample(
  p: number,
  d: number,
  expected: Outcome,
  why: string,
  overrides: Partial<PairInputs> = {}
) {
  return {
    patientId: `sample-patient-${p}`,
    donorId: `sample-donor-${d}`,
    expected,
    why,
    pair: {
      ...defaultPairInputs(),
      distanceNm: 100,
      procurementMinutes: 30,
      transportMinutes: 60,
      implantMinutes: 60,
      perfusionMinutes: 0,
      flowCrossmatch: "negative" as const,
      cdcCrossmatch: "negative" as const,
      ...overrides,
    },
  }
}

/** Expected outcomes use DEFAULT_CRITERIA at SAMPLE_NOW; reasons identify teaching triggers. */
export const SAMPLE_PAIRS: Array<{
  patientId: string
  donorId: string
  pair: PairInputs
  expected: Outcome
  why: string
}> = [
  sample(
    6,
    5,
    "fail",
    "Donor age 46 exceeds this inactive candidate's maximum donor age of 40; donor-heart acceptance fails as well as candidate state and ABO checks."
  ),
  sample(
    1,
    1,
    "pass",
    "Compatible O donor, matched adult size, complete negative screening and short ischemic time."
  ),
  sample(
    1,
    2,
    "fail",
    "A donor to O adult is ABO incompatible; extended donor heart also requires review."
  ),
  sample(
    2,
    2,
    "fail",
    "A24 DSA 8000 MFI and broad A9 unacceptable antigen overlap; older donor LVEF 45 and CAD require review."
  ),
  sample(
    3,
    3,
    "review",
    "Consented HCV NAT-positive donor requires infection review; redo and LVAD explant extend ischemia."
  ),
  sample(
    1,
    3,
    "fail",
    "HCV NAT-positive donor without acceptance and B-to-O ABO incompatibility."
  ),
  sample(
    1,
    4,
    "pass",
    "DCD TA-NRP fWIT 24 minutes, accepted DCD pathway and short cold ischemia."
  ),
  sample(
    4,
    5,
    "review",
    "COHb 22 and troponin 0.4 below CO exclusion thresholds; donor age requires review; PVR 4.8 tightens size checks."
  ),
  sample(
    5,
    2,
    "fail",
    "Infant opted into intended ABO incompatibility but adult donor heart is far above pediatric weight ratio limits."
  ),
  sample(
    6,
    1,
    "fail",
    "Inactive candidate cannot proceed despite otherwise compatible donor."
  ),
  sample(1, 1, "review", "Cold ischemia 300 minutes exceeds pass threshold.", {
    transportMinutes: 210,
  }),
  sample(
    1,
    1,
    "fail",
    "Cold ischemia 390 minutes exceeds maximum review threshold.",
    { transportMinutes: 300 }
  ),
  sample(
    2,
    1,
    "review",
    "Positive flow crossmatch requires review in this highly sensitized candidate, despite no listed DSA to this donor.",
    { flowCrossmatch: "positive" }
  ),
]
