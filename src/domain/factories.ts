import { DONOR_TEST_VALUES, RECIPIENT_TEST_VALUES } from "./options"
import type {
  Donor,
  DonorSerology,
  HlaTyping,
  PairInputs,
  Patient,
  RecipientSerology,
} from "./schema"

/**
 * Blank records for new forms. Safe defaults only:
 * numbers null (not recorded), Yes/No/Unknown fields "unknown",
 * tests "not_done". Nothing defaults to a value that would pass a rule.
 */

export type IdPrefix =
  "pat" | "don" | "evl" | "crv" | "aud" | "ab" | "va" | "run" | "mat" | "dec"

export function newId(prefix: IdPrefix): string {
  return `${prefix}_${crypto.randomUUID()}`
}

export function emptyHlaTyping(): HlaTyping {
  return {
    A: ["", ""],
    B: ["", ""],
    C: ["", ""],
    DRB1: ["", ""],
    DRB345: ["", ""],
    DQA1: ["", ""],
    DQB1: ["", ""],
    DPA1: ["", ""],
    DPB1: ["", ""],
    bw4: "unknown",
    bw6: "unknown",
    typingDate: "",
    method: "",
  }
}

const recipientSerology = (): RecipientSerology =>
  Object.fromEntries(
    RECIPIENT_TEST_VALUES.map((t) => [t, "not_done"])
  ) as RecipientSerology

const donorSerology = (): DonorSerology =>
  Object.fromEntries(
    DONOR_TEST_VALUES.map((t) => [t, "not_done"])
  ) as DonorSerology

export function emptyPatient(now: Date = new Date()): Patient {
  const stamp = now.toISOString()
  return {
    id: newId("pat"),
    createdAt: stamp,
    updatedAt: stamp,
    identity: {
      mrn: "",
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      sex: "male",
      ethnicity: "unknown",
      transplantCenter: "",
      attendingPhysician: "",
    },
    listing: {
      state: "evaluation",
      listingDate: "",
      urgencyStatus: null,
      statusCriterion: "",
      statusDate: "",
      statusExpiresOn: "",
      multiOrgan: false,
      otherOrgans: "",
    },
    body: { heightCm: null, weightKg: null },
    blood: {
      abo: null,
      subtype: "none",
      verifiedTwoSamples: false,
      acceptsIncompatible: false,
      antiATiter: null,
      antiBTiter: null,
      titerDate: "",
      titerLoweringTherapyWithin30Days: false,
    },
    diagnosis: { primary: null, detail: "", diagnosisDate: "" },
    hemodynamics: {
      catheterizationDate: "",
      paSystolic: null,
      paDiastolic: null,
      paMean: null,
      pcwp: null,
      rap: null,
      cardiacOutput: null,
      cardiacIndex: null,
      systolicBp: null,
      meanArterialPressure: null,
      mixedVenousSat: null,
      onInotropesDuringCath: false,
      vasodilatorChallengeDone: false,
      pvrAfterChallenge: null,
    },
    support: {
      device: "none",
      deviceBrand: "",
      deviceImplantDate: "",
      inotropes: [],
      mechanicalVentilation: false,
      inhaledNitricOxide: false,
      icd: false,
    },
    function: {
      lvef: null,
      nyha: null,
      peakVo2: null,
      onBetaBlocker: false,
      hospitalized: false,
      inIcu: false,
    },
    labs: {
      labDate: "",
      creatinine: null,
      egfr: null,
      dialysis: "none",
      bilirubin: null,
      albumin: null,
      inr: null,
      ast: null,
      alt: null,
      sodium: null,
      bnp: null,
      ntProBnp: null,
      hba1c: null,
      hemoglobin: null,
      lactate: null,
    },
    history: {
      diabetes: "unknown",
      diabetesEndOrganDamage: false,
      priorSternotomies: null,
      priorCardiacSurgery: "",
      malignancyHistory: "unknown",
      malignancyDetail: "",
      cerebrovascularDisease: "unknown",
      peripheralVascularDisease: "unknown",
      smoking: "unknown",
      smokingQuitDate: "",
      substanceUse: "unknown",
      frailty: "unknown",
      psychosocialConcerns: "",
    },
    sensitization: {
      cpra: null,
      cpraPeak: null,
      cpraDate: "",
      pregnancies: null,
      transfusions: "unknown",
      priorTransplants: null,
      priorHomograft: false,
      desensitization: "",
      antibodies: [],
      unacceptableAntigens: [],
    },
    hla: emptyHlaTyping(),
    serology: recipientSerology(),
    serologyDate: "",
    enrolledHivResearchProtocol: false,
    acceptance: {
      maxDonorAge: null,
      minDonorWeightKg: null,
      maxDonorWeightKg: null,
      maxDistanceNm: null,
      acceptDcd: true,
      acceptHcvNat: false,
      acceptHcvAb: false,
      acceptAntiHbc: false,
      acceptHbvNat: false,
      acceptPhsRisk: false,
    },
    notes: "",
  }
}

export function emptyDonor(now: Date = new Date()): Donor {
  const stamp = now.toISOString()
  return {
    id: newId("don"),
    createdAt: stamp,
    updatedAt: stamp,
    identity: {
      donorId: "",
      state: "available",
      donorHospital: "",
      opo: "",
      referralDate: "",
      ageYears: null,
      sex: "male",
      ethnicity: "unknown",
    },
    body: { heightCm: null, weightKg: null },
    blood: { abo: null, subtype: "none", verifiedTwoSamples: false },
    donation: {
      type: "dbd",
      brainDeathDate: "",
      dcdRecovery: null,
      agonalPhaseMinutes: null,
      functionalWarmIschemiaMinutes: null,
      noTouchMinutes: null,
    },
    death: {
      cause: null,
      mechanism: null,
      circumstance: null,
      carbonMonoxidePoisoning: false,
      carboxyhemoglobinPct: null,
      cardiacArrest: "unknown",
      cprMinutes: null,
      unexplainedSuddenDeath: false,
    },
    history: {
      hypertension: "unknown",
      diabetes: "unknown",
      insulinDependent: false,
      cigarettesOver20PackYears: "unknown",
      cocaine: "unknown",
      amphetamines: "unknown",
      ivDrugUse: "unknown",
      heavyAlcohol: "unknown",
      priorMi: "unknown",
      knownCad: "unknown",
      priorCardiacSurgery: "unknown",
      malignancyRisk: "unknown",
      malignancyDetail: "",
      transfusionsThisAdmission: "unknown",
      bornInChagasEndemicCountry: "unknown",
      phsRiskCriteria: [],
    },
    hemodynamics: {
      heartRate: null,
      systolicBp: null,
      meanArterialPressure: null,
      cvp: null,
      pcwp: null,
      cardiacIndex: null,
      cardiacOutput: null,
      temperatureC: null,
      vasoactives: [],
      thyroidHormone: false,
      steroids: false,
      ecmo: "none",
    },
    echo: {
      echoDate: "",
      lvef: null,
      lvefMethod: "echo",
      repeatLvef: null,
      septumMm: null,
      posteriorWallMm: null,
      wallMotion: "unknown",
      valveDisease: "unknown",
      rvFunction: "unknown",
      congenitalAbnormality: "unknown",
    },
    coronary: {
      angiography: "not_done",
      vesselsOver50: null,
      leftMainDisease: false,
      coronaryAnomaly: "unknown",
    },
    ecg: {
      lvhCriteria: "unknown",
      ischemicChanges: "unknown",
      significantArrhythmia: "unknown",
      qtcMs: null,
    },
    labs: {
      sodiumPeak: null,
      sodiumLatest: null,
      troponinIPeak: null,
      troponinTPeak: null,
      ckMb: null,
      bnp: null,
      creatinine: null,
      lactate: null,
      ph: null,
      pao2: null,
      fio2: null,
      hemoglobin: null,
      glucose: null,
      ast: null,
      alt: null,
      bilirubin: null,
    },
    infection: {
      serology: donorSerology(),
      sampleDrawnWithin96h: false,
      bloodCulturePositive: "unknown",
      bloodCultureTargetedTherapy: false,
      cnsInfection: "unknown",
      chestXray: "not_done",
    },
    hla: emptyHlaTyping(),
    notes: "",
  }
}

export function defaultPairInputs(): PairInputs {
  return {
    distanceNm: null,
    procurementMinutes: null,
    transportMinutes: null,
    implantMinutes: null,
    preservation: "static_cold",
    perfusionMinutes: null,
    flowCrossmatch: "not_done",
    cdcCrossmatch: "not_done",
  }
}
