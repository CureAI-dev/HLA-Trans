import { z } from "zod"
import { parseIsoDate } from "./dates"

import {
  ABO_SUBTYPE_VALUES,
  ABO_VALUES,
  C1Q_VALUES,
  CANDIDATE_STATE_VALUES,
  CAUSE_OF_DEATH_VALUES,
  CHEST_XRAY_VALUES,
  CIRCUMSTANCE_OF_DEATH_VALUES,
  CNS_INFECTION_VALUES,
  CORONARY_ANGIO_VALUES,
  CROSSMATCH_VALUES,
  DCD_RECOVERY_VALUES,
  DECISION_VERDICT_VALUES,
  DECLINE_REASON_VALUES,
  DIABETES_VALUES,
  DIALYSIS_VALUES,
  DONATION_TYPE_VALUES,
  DONOR_ECMO_VALUES,
  DONOR_STATE_VALUES,
  DONOR_TEST_VALUES,
  ETHNICITY_VALUES,
  HEART_DIAGNOSIS_VALUES,
  HISTORY_DURATION_VALUES,
  INOTROPE_AGENT_VALUES,
  LVEF_METHOD_VALUES,
  MALIGNANCY_RISK_VALUES,
  MCS_DEVICE_VALUES,
  MECHANISM_OF_DEATH_VALUES,
  NYHA_VALUES,
  PHS_RISK_VALUES,
  PRESERVATION_VALUES,
  RECIPIENT_TEST_VALUES,
  RV_FUNCTION_VALUES,
  SEROLOGY_VALUES,
  SEX_VALUES,
  SMOKING_VALUES,
  TRANSFUSION_BAND_VALUES,
  TRI_VALUES,
  URGENCY_STATUS_VALUES,
  VALVE_FINDING_VALUES,
  WALL_MOTION_VALUES,
  type DonorTest,
  type RecipientTest,
} from "./options"

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

/** Optional measured number. `null` = not recorded (never coerced to 0). */
const num = z.number().finite().nullable()
const nonNeg = z.number().finite().min(0).nullable()
const pct = z.number().finite().min(0).max(100).nullable()
const text = z.string().max(4000)
const shortText = z.string().max(200)
/** ISO date (YYYY-MM-DD) or empty when not recorded. */
const isoDate = z
  .string()
  .refine((value) => value === "" || parseIsoDate(value) !== null, "Use the date picker (YYYY-MM-DD).")
const isoDateTime = z.string().datetime({ offset: true })
const id = z.string().min(1).max(64)

const tri = z.enum(TRI_VALUES)
const serology = z.enum(SEROLOGY_VALUES)

/* ------------------------------------------------------------------ */
/* HLA                                                                 */
/* ------------------------------------------------------------------ */

/** Two typed values per locus. Empty string = not typed / homozygous blank. */
const locusPair = z.tuple([shortText, shortText])

export const HLA_LOCI = [
  "A",
  "B",
  "C",
  "DRB1",
  "DRB345",
  "DQA1",
  "DQB1",
  "DPA1",
  "DPB1",
] as const
export type HlaLocus = (typeof HLA_LOCI)[number]

export const hlaTypingSchema = z.object({
  A: locusPair,
  B: locusPair,
  C: locusPair,
  DRB1: locusPair,
  DRB345: locusPair,
  DQA1: locusPair,
  DQB1: locusPair,
  DPA1: locusPair,
  DPB1: locusPair,
  bw4: tri,
  bw6: tri,
  typingDate: isoDate,
  method: shortText,
})
export type HlaTyping = z.infer<typeof hlaTypingSchema>

export const antibodySchema = z.object({
  id,
  /** Antigen as reported by the lab, e.g. "A2", "B44", "DQ7", "DPB1*04:01". */
  antigen: shortText.min(1),
  mfi: z.number().finite().min(0).max(100000),
  c1q: z.enum(C1Q_VALUES),
  testDate: isoDate,
})
export type Antibody = z.infer<typeof antibodySchema>

/* ------------------------------------------------------------------ */
/* Shared clinical blocks                                              */
/* ------------------------------------------------------------------ */

export const vasoactiveSchema = z.object({
  id,
  agent: z.enum(INOTROPE_AGENT_VALUES),
  /** mcg/kg/min for catecholamines/milrinone; units/h for vasopressin. */
  dose: nonNeg,
})
export type Vasoactive = z.infer<typeof vasoactiveSchema>

const recipientSerologySchema = z.object(
  Object.fromEntries(RECIPIENT_TEST_VALUES.map((t) => [t, serology])) as Record<
    RecipientTest,
    typeof serology
  >
)
export type RecipientSerology = z.infer<typeof recipientSerologySchema>

const donorSerologySchema = z.object(
  Object.fromEntries(DONOR_TEST_VALUES.map((t) => [t, serology])) as Record<
    DonorTest,
    typeof serology
  >
)
export type DonorSerology = z.infer<typeof donorSerologySchema>

/* ------------------------------------------------------------------ */
/* Recipient / candidate                                               */
/* ------------------------------------------------------------------ */

export const patientSchema = z.object({
  id,
  createdAt: isoDateTime,
  updatedAt: isoDateTime,

  identity: z.object({
    mrn: shortText.min(1, "Medical record number is required."),
    firstName: shortText.min(1, "First name is required."),
    lastName: shortText.min(1, "Last name is required."),
    dateOfBirth: isoDate.refine((v) => v !== "", "Date of birth is required."),
    sex: z.enum(SEX_VALUES),
    ethnicity: z.enum(ETHNICITY_VALUES),
    transplantCenter: shortText,
    attendingPhysician: shortText,
  }),

  listing: z.object({
    state: z.enum(CANDIDATE_STATE_VALUES),
    listingDate: isoDate,
    urgencyStatus: z.enum(URGENCY_STATUS_VALUES).nullable(),
    statusCriterion: shortText,
    statusDate: isoDate,
    statusExpiresOn: isoDate,
    multiOrgan: z.boolean(),
    otherOrgans: shortText,
  }),

  body: z.object({
    heightCm: z.number().finite().min(30).max(250).nullable(),
    weightKg: z.number().finite().min(1).max(350).nullable(),
  }),

  blood: z.object({
    abo: z.enum(ABO_VALUES).nullable(),
    subtype: z.enum(ABO_SUBTYPE_VALUES),
    /** OPTN 3.3.A–B (candidate), 2.7.A–C (donor): two samples on separate occasions, reported independently. */
    verifiedTwoSamples: z.boolean(),
    /** Pediatric intended ABO-incompatible acceptance (OPTN 6.6.B). */
    acceptsIncompatible: z.boolean(),
    antiATiter: nonNeg,
    antiBTiter: nonNeg,
    titerDate: isoDate,
    titerLoweringTherapyWithin30Days: z.boolean(),
  }),

  diagnosis: z.object({
    primary: z.enum(HEART_DIAGNOSIS_VALUES).nullable(),
    detail: text,
    diagnosisDate: isoDate,
  }),

  hemodynamics: z.object({
    catheterizationDate: isoDate,
    paSystolic: nonNeg,
    paDiastolic: nonNeg,
    paMean: nonNeg,
    pcwp: nonNeg,
    rap: nonNeg,
    cardiacOutput: nonNeg,
    /** Measured CI; if null the app derives CO / BSA. */
    cardiacIndex: nonNeg,
    systolicBp: nonNeg,
    meanArterialPressure: nonNeg,
    mixedVenousSat: pct,
    onInotropesDuringCath: z.boolean(),
    vasodilatorChallengeDone: z.boolean(),
    pvrAfterChallenge: nonNeg,
  }),

  support: z.object({
    device: z.enum(MCS_DEVICE_VALUES),
    deviceBrand: shortText,
    deviceImplantDate: isoDate,
    inotropes: z.array(vasoactiveSchema).max(10),
    mechanicalVentilation: z.boolean(),
    inhaledNitricOxide: z.boolean(),
    icd: z.boolean(),
  }),

  function: z.object({
    lvef: pct,
    nyha: z.enum(NYHA_VALUES).nullable(),
    peakVo2: nonNeg,
    onBetaBlocker: z.boolean(),
    hospitalized: z.boolean(),
    inIcu: z.boolean(),
  }),

  labs: z.object({
    labDate: isoDate,
    creatinine: nonNeg,
    egfr: nonNeg,
    dialysis: z.enum(DIALYSIS_VALUES),
    bilirubin: nonNeg,
    albumin: nonNeg,
    inr: nonNeg,
    ast: nonNeg,
    alt: nonNeg,
    sodium: nonNeg,
    bnp: nonNeg,
    ntProBnp: nonNeg,
    hba1c: nonNeg,
    hemoglobin: nonNeg,
    lactate: nonNeg,
  }),

  history: z.object({
    diabetes: z.enum(DIABETES_VALUES),
    diabetesEndOrganDamage: z.boolean(),
    priorSternotomies: z.number().int().min(0).max(20).nullable(),
    priorCardiacSurgery: text,
    malignancyHistory: tri,
    malignancyDetail: text,
    cerebrovascularDisease: tri,
    peripheralVascularDisease: tri,
    smoking: z.enum(SMOKING_VALUES),
    smokingQuitDate: isoDate,
    substanceUse: tri,
    frailty: tri,
    psychosocialConcerns: text,
  }),

  sensitization: z.object({
    cpra: pct,
    cpraPeak: pct,
    cpraDate: isoDate,
    pregnancies: z.number().int().min(0).max(30).nullable(),
    transfusions: z.enum(TRANSFUSION_BAND_VALUES),
    priorTransplants: z.number().int().min(0).max(10).nullable(),
    priorHomograft: z.boolean(),
    desensitization: text,
    antibodies: z.array(antibodySchema).max(300),
    /** Center-designated unacceptable antigens (expanded via broad/split tables). */
    unacceptableAntigens: z.array(shortText.min(1)).max(300),
  }),

  hla: hlaTypingSchema,

  serology: recipientSerologySchema,
  serologyDate: isoDate,
  /** HOPE Act: HIV+ to HIV+ only under an IRB-approved research protocol. */
  enrolledHivResearchProtocol: z.boolean(),

  /** Candidate-specific offer filters set by the transplant program. */
  acceptance: z.object({
    maxDonorAge: nonNeg,
    minDonorWeightKg: nonNeg,
    maxDonorWeightKg: nonNeg,
    maxDistanceNm: nonNeg,
    acceptDcd: z.boolean(),
    acceptHcvNat: z.boolean(),
    acceptHcvAb: z.boolean(),
    acceptAntiHbc: z.boolean(),
    acceptHbvNat: z.boolean(),
    acceptPhsRisk: z.boolean(),
  }),

  notes: text,
})
export type Patient = z.infer<typeof patientSchema>

/* ------------------------------------------------------------------ */
/* Donor                                                               */
/* ------------------------------------------------------------------ */

export const donorSchema = z.object({
  id,
  createdAt: isoDateTime,
  updatedAt: isoDateTime,

  identity: z.object({
    donorId: shortText.min(1, "Donor ID is required."),
    state: z.enum(DONOR_STATE_VALUES),
    donorHospital: shortText,
    opo: shortText,
    referralDate: isoDate,
    ageYears: z.number().finite().min(0).max(100).nullable(),
    sex: z.enum(SEX_VALUES),
    ethnicity: z.enum(ETHNICITY_VALUES),
  }),

  body: z.object({
    heightCm: z.number().finite().min(30).max(250).nullable(),
    weightKg: z.number().finite().min(1).max(350).nullable(),
  }),

  blood: z.object({
    abo: z.enum(ABO_VALUES).nullable(),
    subtype: z.enum(ABO_SUBTYPE_VALUES),
    verifiedTwoSamples: z.boolean(),
  }),

  donation: z.object({
    type: z.enum(DONATION_TYPE_VALUES),
    brainDeathDate: isoDate,
    dcdRecovery: z.enum(DCD_RECOVERY_VALUES).nullable(),
    agonalPhaseMinutes: nonNeg,
    functionalWarmIschemiaMinutes: nonNeg,
    noTouchMinutes: nonNeg,
  }),

  death: z.object({
    cause: z.enum(CAUSE_OF_DEATH_VALUES).nullable(),
    mechanism: z.enum(MECHANISM_OF_DEATH_VALUES).nullable(),
    circumstance: z.enum(CIRCUMSTANCE_OF_DEATH_VALUES).nullable(),
    carbonMonoxidePoisoning: z.boolean(),
    carboxyhemoglobinPct: pct,
    cardiacArrest: tri,
    cprMinutes: nonNeg,
    unexplainedSuddenDeath: z.boolean(),
  }),

  history: z.object({
    hypertension: z.enum(HISTORY_DURATION_VALUES),
    diabetes: z.enum(HISTORY_DURATION_VALUES),
    insulinDependent: z.boolean(),
    cigarettesOver20PackYears: tri,
    cocaine: tri,
    amphetamines: tri,
    ivDrugUse: tri,
    heavyAlcohol: tri,
    priorMi: tri,
    knownCad: tri,
    priorCardiacSurgery: tri,
    malignancyRisk: z.enum(MALIGNANCY_RISK_VALUES),
    malignancyDetail: text,
    transfusionsThisAdmission: z.enum(TRANSFUSION_BAND_VALUES),
    bornInChagasEndemicCountry: tri,
    phsRiskCriteria: z.array(z.enum(PHS_RISK_VALUES)).max(10),
  }),

  hemodynamics: z.object({
    heartRate: nonNeg,
    systolicBp: nonNeg,
    meanArterialPressure: nonNeg,
    cvp: num,
    pcwp: nonNeg,
    cardiacIndex: nonNeg,
    cardiacOutput: nonNeg,
    temperatureC: z.number().finite().min(20).max(45).nullable(),
    vasoactives: z.array(vasoactiveSchema).max(10),
    thyroidHormone: z.boolean(),
    steroids: z.boolean(),
    ecmo: z.enum(DONOR_ECMO_VALUES),
  }),

  echo: z.object({
    echoDate: isoDate,
    lvef: pct,
    lvefMethod: z.enum(LVEF_METHOD_VALUES),
    /** Follow-up LVEF after optimization (serial echo). */
    repeatLvef: pct,
    septumMm: nonNeg,
    posteriorWallMm: nonNeg,
    wallMotion: z.enum(WALL_MOTION_VALUES),
    valveDisease: z.enum(VALVE_FINDING_VALUES),
    rvFunction: z.enum(RV_FUNCTION_VALUES),
    congenitalAbnormality: tri,
  }),

  coronary: z.object({
    angiography: z.enum(CORONARY_ANGIO_VALUES),
    vesselsOver50: z.number().int().min(0).max(3).nullable(),
    leftMainDisease: z.boolean(),
    coronaryAnomaly: tri,
  }),

  ecg: z.object({
    lvhCriteria: tri,
    ischemicChanges: tri,
    significantArrhythmia: tri,
    qtcMs: nonNeg,
  }),

  labs: z.object({
    sodiumPeak: nonNeg,
    sodiumLatest: nonNeg,
    troponinIPeak: nonNeg,
    troponinTPeak: nonNeg,
    ckMb: nonNeg,
    bnp: nonNeg,
    creatinine: nonNeg,
    lactate: nonNeg,
    ph: z.number().finite().min(6).max(8).nullable(),
    pao2: nonNeg,
    fio2: pct,
    hemoglobin: nonNeg,
    glucose: nonNeg,
    ast: nonNeg,
    alt: nonNeg,
    bilirubin: nonNeg,
  }),

  infection: z.object({
    serology: donorSerologySchema,
    sampleDrawnWithin96h: z.boolean(),
    bloodCulturePositive: tri,
    bloodCultureTargetedTherapy: z.boolean(),
    cnsInfection: z.enum(CNS_INFECTION_VALUES),
    chestXray: z.enum(CHEST_XRAY_VALUES),
  }),

  hla: hlaTypingSchema,

  notes: text,
})
export type Donor = z.infer<typeof donorSchema>

/* ------------------------------------------------------------------ */
/* Criteria (doctor-editable)                                          */
/* ------------------------------------------------------------------ */

const outcome = z.enum(["pass", "review", "fail"])

export const criteriaSchema = z.object({
  abo: z.object({
    allowPediatricIncompatible: z.boolean(),
    /** Max isohemagglutinin titer (denominator) for candidates >= 1 year. */
    maxTiterOneYearPlus: z.number().finite().min(1).max(4096),
  }),
  size: z.object({
    phmRatioPassMin: z.number().finite().min(0.3).max(1.5),
    phmRatioReviewMin: z.number().finite().min(0.3).max(1.5),
    phmRatioReviewMax: z.number().finite().min(1).max(3),
    weightRatioPassMin: z.number().finite().min(0.3).max(1.5),
    weightRatioReviewMin: z.number().finite().min(0.3).max(1.5),
    femaleToMaleWeightRatioMin: z.number().finite().min(0.3).max(1.5),
    pulmonaryHypertensionPvr: z.number().finite().min(1).max(15),
    phmRatioMinWithPulmonaryHypertension: z.number().finite().min(0.5).max(1.5),
    pediatricWeightRatioMin: z.number().finite().min(0.1).max(2),
    pediatricWeightRatioMax: z.number().finite().min(1).max(6),
  }),
  immunology: z.object({
    mfiReviewMin: z.number().finite().min(0).max(30000),
    mfiFailMin: z.number().finite().min(0).max(30000),
    c1qPositiveOutcome: outcome,
    unacceptableAntigenOutcome: outcome,
    cpraSensitizedMin: z.number().finite().min(0).max(100),
    flowCrossmatchPositiveOutcome: outcome,
    cdcCrossmatchPositiveOutcome: outcome,
  }),
  infection: z.object({
    hivDonorOutcome: outcome,
    hcvNatOutcome: outcome,
    hcvAbOnlyOutcome: outcome,
    hbsAgOrHbvNatOutcome: outcome,
    antiHbcOnlyOutcome: outcome,
    cmvHighRiskOutcome: outcome,
    ebvHighRiskOutcome: outcome,
    toxoHighRiskOutcome: outcome,
    chagasOutcome: outcome,
    strongyloidesOutcome: outcome,
    syphilisOutcome: outcome,
    wnvOutcome: outcome,
    bacteremiaOutcome: outcome,
    phsRiskOutcome: outcome,
  }),
  donor: z.object({
    ageReviewAbove: z.number().finite().min(0).max(100),
    ageFailAbove: z.number().finite().min(0).max(100).nullable(),
    lvefPassMin: z.number().finite().min(0).max(100),
    lvefReviewMin: z.number().finite().min(0).max(100),
    wallThicknessPassMax: z.number().finite().min(5).max(30),
    wallThicknessReviewMax: z.number().finite().min(5).max(30),
    sodiumFailBelow: z.number().finite().min(100).max(160),
    sodiumFailAtOrAbove: z.number().finite().min(140).max(200),
    sodiumReviewBelow: z.number().finite().min(100).max(160),
    sodiumReviewAbove: z.number().finite().min(140).max(200),
    norepinephrineMaxAlone: z.number().finite().min(0).max(5),
    dopamineReviewAbove: z.number().finite().min(0).max(50),
    vasoactiveAgentsReviewMin: z.number().int().min(1).max(6),
    troponinIReviewAbove: z.number().finite().min(0).max(100),
    cprMinutesReview: z.number().finite().min(0).max(240),
    angioAgeMale: z.number().finite().min(0).max(100),
    angioAgeFemale: z.number().finite().min(0).max(100),
    multivesselCadOutcome: outcome,
    singleVesselCadOutcome: outcome,
    moderateValveOutcome: outcome,
    coHbFailAbove: z.number().finite().min(0).max(100),
    coTroponinFailAtOrAbove: z.number().finite().min(0).max(100),
  }),
  logistics: z.object({
    ischemicPassMaxMinutes: z.number().finite().min(30).max(900),
    ischemicReviewMaxMinutes: z.number().finite().min(30).max(900),
    olderDonorAge: z.number().finite().min(0).max(100),
    dcdFwitPassMaxMinutes: z.number().finite().min(0).max(120),
    dcdFwitReviewMaxMinutes: z.number().finite().min(0).max(120),
    redoSternotomyExtraMinutes: z.number().finite().min(0).max(240),
    deviceExplantExtraMinutes: z.number().finite().min(0).max(240),
  }),
})
export type Criteria = z.infer<typeof criteriaSchema>
export type Outcome = z.infer<typeof outcome>

export const criteriaVersionSchema = z.object({
  id,
  version: z.number().int().min(1),
  createdAt: isoDateTime,
  author: shortText,
  changeNote: text,
  criteria: criteriaSchema,
})
export type CriteriaVersion = z.infer<typeof criteriaVersionSchema>

/* ------------------------------------------------------------------ */
/* Evaluation + decision                                               */
/* ------------------------------------------------------------------ */

/** Pair-specific inputs that belong to neither record alone. */
export const pairInputsSchema = z.object({
  distanceNm: nonNeg,
  /** Donor cross-clamp to departure (cardiectomy, packaging, ground transfer). */
  procurementMinutes: nonNeg,
  transportMinutes: nonNeg,
  /** Base implant time to reperfusion, before redo/explant additions. */
  implantMinutes: nonNeg,
  preservation: z.enum(PRESERVATION_VALUES),
  /** Normothermic perfusion time, excluded from cold ischemia. */
  perfusionMinutes: nonNeg,
  flowCrossmatch: z.enum(CROSSMATCH_VALUES),
  cdcCrossmatch: z.enum(CROSSMATCH_VALUES),
})
export type PairInputs = z.infer<typeof pairInputsSchema>

export const findingSchema = z.object({
  code: shortText,
  status: z.enum(["pass", "review", "fail", "info"]),
  missing: z.boolean(),
  title: shortText,
  detail: text,
  evidence: shortText,
  source: shortText,
})
export type Finding = z.infer<typeof findingSchema>

export const RULE_IDS = [
  "abo",
  "size",
  "immunology",
  "infection",
  "donorHeart",
  "logistics",
] as const
export type RuleId = (typeof RULE_IDS)[number]

export const ruleResultSchema = z.object({
  rule: z.enum(RULE_IDS),
  status: outcome,
  findings: z.array(findingSchema),
})
export type RuleResult = z.infer<typeof ruleResultSchema>

export const evaluationResultSchema = z.object({
  overall: outcome,
  blockers: z.array(findingSchema),
  rules: z.array(ruleResultSchema),
  missingCount: z.number().int().min(0),
  engineVersion: shortText,
})
export type EvaluationResult = z.infer<typeof evaluationResultSchema>

export const decisionSchema = z.object({
  verdict: z.enum(DECISION_VERDICT_VALUES),
  reasons: z.array(z.enum(DECLINE_REASON_VALUES)).max(12),
  clinician: shortText.min(1, "Enter the deciding clinician's name."),
  rationale: text.min(1, "Record the reason for this decision."),
  acknowledgedFindings: z.boolean(),
  decidedAt: isoDateTime,
})
export type Decision = z.infer<typeof decisionSchema>

export const evaluationSchema = z.object({
  id,
  createdAt: isoDateTime,
  createdBy: shortText,
  patientId: id,
  donorId: id,
  /** Immutable copies so later edits never rewrite history. */
  patientSnapshot: patientSchema,
  donorSnapshot: donorSchema,
  criteriaVersionId: id,
  criteriaVersion: z.number().int().min(1),
  criteriaSnapshot: criteriaSchema,
  pair: pairInputsSchema,
  result: evaluationResultSchema,
  decision: decisionSchema.nullable(),
})
export type Evaluation = z.infer<typeof evaluationSchema>

export const auditEntrySchema = z.object({
  id,
  at: isoDateTime,
  actor: shortText,
  action: z.enum([
    "patient.created",
    "patient.updated",
    "patient.deleted",
    "donor.created",
    "donor.updated",
    "donor.deleted",
    "evaluation.created",
    "evaluation.decided",
    "criteria.published",
    "data.imported",
    "data.seeded",
    "data.reset",
  ]),
  subjectId: shortText,
  summary: text,
})
export type AuditEntry = z.infer<typeof auditEntrySchema>
export type AuditAction = AuditEntry["action"]

/* ------------------------------------------------------------------ */
/* Database document                                                   */
/* ------------------------------------------------------------------ */

export const DB_SCHEMA_VERSION = 1

export const dbSchema = z.object({
  schemaVersion: z.literal(DB_SCHEMA_VERSION),
  clinicianName: shortText,
  patients: z.array(patientSchema),
  donors: z.array(donorSchema),
  evaluations: z.array(evaluationSchema),
  criteriaVersions: z.array(criteriaVersionSchema).min(1),
  audit: z.array(auditEntrySchema),
})
export type Db = z.infer<typeof dbSchema>
