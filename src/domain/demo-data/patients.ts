import { emptyPatient } from "../factories"
import { RECIPIENT_TEST_VALUES } from "../options"
import type { HlaTyping, Patient } from "../schema"
import {
  ATTENDINGS,
  CENTERS,
  PATIENT_NAMES,
  bornYearsAgo,
  daysAgo,
  demoNow,
  stampDaysAgo,
  typing,
} from "./people"

/** Recipient typings (none carries A24, B62 or DR15, the sensitized candidate's antibodies). */
const TYPINGS: ReadonlyArray<(date: string) => HlaTyping> = [
  (t) =>
    typing(
      {
        A: "A*02:01 A*11:01",
        B: "B*40:01 B*46:01",
        C: "C*01:02 C*07:02",
        DRB1: "DRB1*09:01 DRB1*12:02",
        DRB345: "DRB3*03:01 DRB4*01:03",
        DQA1: "DQA1*03:02 DQA1*06:01",
        DQB1: "DQB1*03:03 DQB1*03:01",
        DPA1: "DPA1*02:02",
        DPB1: "DPB1*05:01",
      },
      t
    ),
  (t) =>
    typing(
      {
        A: "A*30:01 A*02:01",
        B: "B*42:01 B*53:01",
        C: "C*17:01 C*04:01",
        DRB1: "DRB1*03:02 DRB1*11:01",
        DRB345: "DRB3*01:01 DRB3*02:02",
        DQA1: "DQA1*04:01 DQA1*05:05",
        DQB1: "DQB1*04:02 DQB1*03:01",
        DPA1: "DPA1*02:02 DPA1*01:03",
        DPB1: "DPB1*01:01 DPB1*04:01",
      },
      t
    ),
  (t) =>
    typing(
      {
        A: "A*68:01 A*29:02",
        B: "B*35:12 B*44:03",
        C: "C*04:01 C*16:01",
        DRB1: "DRB1*04:04 DRB1*07:01",
        DRB345: "DRB4*01:03",
        DQA1: "DQA1*03:01 DQA1*02:01",
        DQB1: "DQB1*03:02 DQB1*02:02",
        DPA1: "DPA1*01:03 DPA1*02:01",
        DPB1: "DPB1*04:02 DPB1*11:01",
      },
      t
    ),
  (t) =>
    typing(
      {
        A: "A*01:01 A*02:01",
        B: "B*08:01 B*44:02",
        C: "C*07:01 C*05:01",
        DRB1: "DRB1*03:01 DRB1*04:01",
        DRB345: "DRB3*01:01 DRB4*01:03",
        DQA1: "DQA1*05:01 DQA1*03:01",
        DQB1: "DQB1*02:01 DQB1*03:02",
        DPA1: "DPA1*01:03",
        DPB1: "DPB1*04:01",
      },
      t
    ),
  (t) =>
    typing(
      {
        A: "A*03:01 A*32:01",
        B: "B*07:02 B*14:02",
        C: "C*07:02 C*08:02",
        DRB1: "DRB1*01:01 DRB1*13:01",
        DRB345: "DRB3*01:01",
        DQA1: "DQA1*01:01 DQA1*01:03",
        DQB1: "DQB1*05:01 DQB1*06:03",
        DPA1: "DPA1*01:03",
        DPB1: "DPB1*04:01 DPB1*02:01",
      },
      t
    ),
  (t) =>
    typing(
      {
        A: "A*33:03 A*02:07",
        B: "B*58:01 B*46:01",
        C: "C*03:02 C*01:02",
        DRB1: "DRB1*03:01 DRB1*09:01",
        DRB345: "DRB3*01:01 DRB4*01:03",
        DQA1: "DQA1*05:01 DQA1*03:02",
        DQB1: "DQB1*02:01 DQB1*03:03",
        DPA1: "DPA1*02:02",
        DPB1: "DPB1*05:01 DPB1*02:01",
      },
      t
    ),
  (t) =>
    typing(
      {
        A: "A*23:01 A*30:02",
        B: "B*53:01 B*58:02",
        C: "C*04:01 C*06:02",
        DRB1: "DRB1*11:01 DRB1*13:02",
        DRB345: "DRB3*02:02 DRB3*03:01",
        DQA1: "DQA1*05:05 DQA1*01:02",
        DQB1: "DQB1*03:01 DQB1*06:09",
        DPA1: "DPA1*02:01",
        DPB1: "DPB1*01:01 DPB1*17:01",
      },
      t
    ),
  (t) =>
    typing(
      {
        A: "A*26:01 A*31:01",
        B: "B*38:01 B*51:01",
        C: "C*12:03 C*14:02",
        DRB1: "DRB1*13:01 DRB1*14:01",
        DRB345: "DRB3*01:01 DRB3*02:02",
        DQA1: "DQA1*01:03 DQA1*01:04",
        DQB1: "DQB1*06:03 DQB1*05:03",
        DPA1: "DPA1*01:03",
        DPB1: "DPB1*04:01 DPB1*03:01",
      },
      t
    ),
]

const ETHNICITIES = [
  "asian",
  "black",
  "hispanic",
  "white",
  "asian",
  "white",
  "asian",
  "hispanic",
  "white",
  "white",
  "asian",
  "black",
  "hispanic",
  "white",
  "white",
  "white",
  "asian",
  "white",
  "black",
  "asian",
  "hispanic",
  "black",
  "white",
  "asian",
] as const

/**
 * Fully recorded adult heart-failure candidate: right-heart cath within the
 * month, complete labs, serology resulted, typing complete, cPRA 0. Each
 * candidate then applies its own clinical picture.
 */
function base(i: number, overrides: (p: Patient) => void): Patient {
  const p = emptyPatient(demoNow())
  const [firstName, lastName] = PATIENT_NAMES[i]
  const listedDaysAgo = 40 + i * 11
  p.id = `demo-patient-${String(i + 1).padStart(2, "0")}`
  p.createdAt = stampDaysAgo(listedDaysAgo + 21)
  p.updatedAt = stampDaysAgo(1 + (i % 6))
  Object.assign(p.identity, {
    mrn: `MRN-${String(4_100_000 + i * 7_919).padStart(7, "0")}`,
    firstName,
    lastName,
    dateOfBirth: bornYearsAgo(38 + ((i * 7) % 30), 30 + i * 9),
    sex: i % 2 ? "male" : "female",
    ethnicity: ETHNICITIES[i],
    transplantCenter: CENTERS[i % CENTERS.length],
    attendingPhysician: ATTENDINGS[i % ATTENDINGS.length],
  })
  Object.assign(p.listing, {
    state: "active",
    listingDate: daysAgo(listedDaysAgo),
    urgencyStatus: "A4",
    statusCriterion: "Continuous inotrope infusion with hemodynamic monitoring",
    statusDate: daysAgo(5 + i * 3),
    statusExpiresOn: daysAgo(5 + i * 3 - 90),
    multiOrgan: false,
    otherOrgans: "",
  })
  p.body = { heightCm: 170, weightKg: 75 }
  Object.assign(p.blood, {
    abo: "O",
    subtype: "none",
    verifiedTwoSamples: true,
  })
  Object.assign(p.diagnosis, {
    primary: "1000",
    detail: "Non-ischemic dilated cardiomyopathy",
    diagnosisDate: daysAgo(900 + i * 40),
  })
  Object.assign(p.hemodynamics, {
    catheterizationDate: daysAgo(12 + (i % 10)),
    paSystolic: 42,
    paDiastolic: 20,
    paMean: 28,
    pcwp: 18,
    rap: 10,
    cardiacOutput: 4.2,
    cardiacIndex: null,
    systolicBp: 96,
    meanArterialPressure: 72,
    mixedVenousSat: 56,
    onInotropesDuringCath: true,
    vasodilatorChallengeDone: false,
    pvrAfterChallenge: null,
  })
  Object.assign(p.support, {
    device: "none",
    deviceBrand: "",
    deviceImplantDate: "",
    inotropes: [{ id: `${p.id}-ino-1`, agent: "milrinone", dose: 0.375 }],
    mechanicalVentilation: false,
    inhaledNitricOxide: false,
    icd: true,
  })
  Object.assign(p.function, {
    lvef: 18,
    nyha: "IV",
    peakVo2: 10.8,
    onBetaBlocker: false,
    hospitalized: true,
    inIcu: false,
  })
  Object.assign(p.labs, {
    labDate: daysAgo(1),
    creatinine: 1.3,
    egfr: 58,
    dialysis: "none",
    bilirubin: 1.1,
    albumin: 3.6,
    inr: 1.2,
    ast: 32,
    alt: 28,
    sodium: 134,
    bnp: 1240,
    ntProBnp: null,
    hba1c: 5.8,
    hemoglobin: 11.9,
    lactate: 1.3,
  })
  Object.assign(p.history, {
    diabetes: "none",
    diabetesEndOrganDamage: false,
    priorSternotomies: 0,
    priorCardiacSurgery: "",
    malignancyHistory: "no",
    malignancyDetail: "",
    cerebrovascularDisease: "no",
    peripheralVascularDisease: "no",
    smoking: "never",
    smokingQuitDate: "",
    substanceUse: "no",
    frailty: "no",
    psychosocialConcerns: "",
  })
  Object.assign(p.sensitization, {
    cpra: 0,
    cpraPeak: 0,
    cpraDate: daysAgo(14),
    pregnancies: 0,
    transfusions: "none",
    priorTransplants: 0,
    priorHomograft: false,
    desensitization: "",
    antibodies: [],
    unacceptableAntigens: [],
  })
  p.hla = TYPINGS[i % TYPINGS.length](daysAgo(listedDaysAgo + 10))
  for (const t of RECIPIENT_TEST_VALUES) p.serology[t] = "negative"
  Object.assign(p.serology, {
    antiHbs: "positive",
    ebvIgG: "positive",
    vzvIgG: "positive",
    cmvIgG: i % 3 ? "positive" : "negative",
  })
  p.serologyDate = daysAgo(14)
  p.notes = ""
  overrides(p)
  return p
}

const age = (p: Patient, years: number, extraDays = 120) => {
  p.identity.dateOfBirth = bornYearsAgo(years, extraDays)
}
const noInotropes = (p: Patient) => {
  p.support.inotropes = []
  p.hemodynamics.onInotropesDuringCath = false
}

export const DEMO_PATIENTS: Patient[] = [
  // 01 Maya Chen: VA-ECMO, status 1. Reference O recipient.
  base(0, (p) => {
    age(p, 41)
    p.listing.urgencyStatus = "A1"
    p.listing.statusCriterion = "VA-ECMO for cardiogenic shock"
    p.listing.statusDate = daysAgo(6)
    p.listing.statusExpiresOn = daysAgo(-1)
    p.body = { heightCm: 176, weightKg: 82 }
    Object.assign(p.diagnosis, {
      primary: "1004",
      detail:
        "Fulminant lymphocytic myocarditis (biopsy-proven), no recovery after 6 days of mechanical support",
    })
    Object.assign(p.support, {
      device: "va_ecmo",
      deviceBrand: "Cardiohelp, femoral cannulation with LV vent",
      deviceImplantDate: daysAgo(6),
      mechanicalVentilation: true,
    })
    p.support.inotropes = [
      { id: "demo-patient-01-ino-1", agent: "epinephrine", dose: 0.03 },
    ]
    Object.assign(p.function, { lvef: 10, inIcu: true, peakVo2: null })
    Object.assign(p.labs, {
      creatinine: 1.6,
      egfr: 42,
      lactate: 2.1,
      bilirubin: 2.3,
    })
    Object.assign(p.acceptance, { maxDonorAge: 50, maxDistanceNm: 750 })
    p.notes =
      "VA-ECMO day 6 after cardiogenic shock from fulminant myocarditis; biopsy lymphocytic, no recovery on serial echo (LVEF 10%). " +
      "Intubated, lightly sedated, neuro intact. Family aware; will accept offers up to 750 NM and donor age ≤50."
  }),
  // 02 Daniel Okonkwo: HeartMate 3 with driveline infection; redo sternotomy.
  base(1, (p) => {
    age(p, 52)
    p.listing.urgencyStatus = "A3"
    p.listing.statusCriterion = "Durable LVAD with device-related infection"
    p.body = { heightCm: 183, weightKg: 92 }
    p.blood.abo = "A"
    Object.assign(p.diagnosis, {
      primary: "1007",
      detail: "Ischemic cardiomyopathy; prior anterior STEMI",
    })
    Object.assign(p.support, {
      device: "lvad_durable",
      deviceBrand: "HeartMate 3",
      deviceImplantDate: daysAgo(780),
    })
    noInotropes(p)
    Object.assign(p.function, { lvef: 15, nyha: "III", hospitalized: false })
    Object.assign(p.history, {
      priorSternotomies: 1,
      priorCardiacSurgery: "HeartMate 3 implant via sternotomy",
      diabetes: "type2",
      smoking: "former",
      smokingQuitDate: daysAgo(3200),
    })
    Object.assign(p.sensitization, { transfusions: "6-10" })
    Object.assign(p.acceptance, { maxDistanceNm: 1000 })
    p.notes =
      "HM3 since 2 yrs, upgraded to status 3 for recurrent driveline infection (MSSA) on suppressive cefadroxil. Redo sternotomy x1; " +
      "surgeon requests 1 h extra for explant. Prior transfusions during VAD implant, cPRA remains 0%."
  }),
  // 03 Sofia Ramirez: highly sensitized after pregnancies.
  base(2, (p) => {
    age(p, 34)
    p.listing.urgencyStatus = "A2"
    p.listing.statusCriterion = "IABP for cardiogenic shock"
    p.body = { heightCm: 170, weightKg: 76 }
    p.blood.abo = "B"
    Object.assign(p.diagnosis, {
      primary: "1002",
      detail: "Peripartum cardiomyopathy, no recovery at 18 months",
    })
    Object.assign(p.support, {
      device: "iabp",
      deviceBrand: "Axillary IABP",
      deviceImplantDate: daysAgo(9),
    })
    p.function.inIcu = true
    Object.assign(p.sensitization, {
      cpra: 82,
      cpraPeak: 88,
      pregnancies: 3,
      transfusions: "1-5",
      desensitization:
        "IVIG 2 g/kg x2 completed; plasmapheresis on hold pending offer",
      antibodies: [
        {
          id: "demo-patient-03-ab-1",
          antigen: "A24",
          mfi: 8200,
          c1q: "negative",
          testDate: daysAgo(14),
        },
        {
          id: "demo-patient-03-ab-2",
          antigen: "B62",
          mfi: 4100,
          c1q: "negative",
          testDate: daysAgo(14),
        },
        {
          id: "demo-patient-03-ab-3",
          antigen: "DR15",
          mfi: 2600,
          c1q: "not_done",
          testDate: daysAgo(14),
        },
        {
          id: "demo-patient-03-ab-4",
          antigen: "DQ6",
          mfi: 1500,
          c1q: "not_done",
          testDate: daysAgo(14),
        },
      ],
      unacceptableAntigens: ["A24", "B62"],
    })
    p.notes =
      "Highly sensitized after three pregnancies (cPRA 82%, peak 88%). Unacceptables A24 and B62 listed; DR15 moderate. " +
      "Virtual crossmatch required for every offer, prospective flow crossmatch if time allows. Axillary IABP, ambulating."
  }),
  // 04 Ethan Walsh: inotrope-dependent ischemic cardiomyopathy, distance limit.
  base(3, (p) => {
    age(p, 58)
    p.body = { heightCm: 178, weightKg: 80 }
    Object.assign(p.diagnosis, {
      primary: "1007",
      detail: "Ischemic cardiomyopathy, three-vessel CAD not revascularisable",
    })
    Object.assign(p.history, {
      smoking: "former",
      smokingQuitDate: daysAgo(2400),
      peripheralVascularDisease: "no",
    })
    Object.assign(p.acceptance, { maxDistanceNm: 500, maxDonorAge: 55 })
    p.notes =
      "Milrinone 0.375 since admission, CI 1.9 off support. Ischemic CM, no revascularisation options per heart team. " +
      "Prefers regional offers (≤500 NM)."
  }),
  // 05 Aisha Rahman: infant with HLHS, intended ABO-incompatible pathway.
  base(4, (p) => {
    p.identity.dateOfBirth = bornYearsAgo(0, 210)
    p.listing.urgencyStatus = "P1A"
    p.listing.statusCriterion = "Ventilated, high-dose inotropes"
    p.listing.listingDate = daysAgo(60)
    p.body = { heightCm: 66, weightKg: 7.4 }
    Object.assign(p.blood, {
      abo: "B",
      acceptsIncompatible: true,
      antiATiter: 4,
      antiBTiter: null,
      titerDate: daysAgo(3),
    })
    Object.assign(p.diagnosis, {
      primary: "1205",
      detail:
        "Hypoplastic left heart syndrome, failing Norwood with severe tricuspid regurgitation",
      diagnosisDate: bornYearsAgo(0, 210),
    })
    Object.assign(p.hemodynamics, {
      paSystolic: null,
      paDiastolic: null,
      paMean: 18,
      pcwp: 8,
      rap: 9,
      cardiacOutput: 1.1,
      systolicBp: 72,
      meanArterialPressure: 52,
      mixedVenousSat: 48,
    })
    Object.assign(p.support, { mechanicalVentilation: true, icd: false })
    p.support.inotropes = [
      { id: "demo-patient-05-ino-1", agent: "milrinone", dose: 0.5 },
      { id: "demo-patient-05-ino-2", agent: "epinephrine", dose: 0.05 },
    ]
    Object.assign(p.function, {
      lvef: null,
      nyha: null,
      peakVo2: null,
      inIcu: true,
    })
    Object.assign(p.labs, {
      creatinine: 0.4,
      egfr: null,
      bnp: 2800,
      hba1c: null,
      hemoglobin: 13.8,
    })
    Object.assign(p.serology, {
      cmvIgG: "negative",
      ebvIgG: "negative",
      vzvIgG: "negative",
      antiHbs: "negative",
    })
    Object.assign(p.acceptance, { minDonorWeightKg: 4, maxDonorWeightKg: 20 })
    p.notes =
      "7-month-old with HLHS, failing Norwood circulation, severe TR. Intubated in CICU on milrinone and epinephrine. " +
      "Parents consented to the intended ABO-incompatible pathway; anti-A 1:4. Accept donors 4–20 kg."
  }),
  // 06 Lucas Moreau: 6-year-old, myocarditis-related DCM, not consented for ABOi.
  base(5, (p) => {
    age(p, 6, 150)
    p.listing.urgencyStatus = "P1B"
    p.listing.statusCriterion = "Continuous inotrope infusion"
    p.body = { heightCm: 116, weightKg: 20 }
    Object.assign(p.blood, {
      abo: "O",
      acceptsIncompatible: false,
      antiATiter: 64,
      antiBTiter: 128,
      titerDate: daysAgo(10),
    })
    Object.assign(p.diagnosis, {
      primary: "1006",
      detail: "Post-viral dilated cardiomyopathy (enterovirus)",
    })
    Object.assign(p.hemodynamics, {
      paSystolic: 34,
      paDiastolic: 16,
      paMean: 24,
      pcwp: 16,
      rap: 8,
      cardiacOutput: 2.4,
      systolicBp: 88,
      meanArterialPressure: 64,
    })
    p.support.inotropes = [
      { id: "demo-patient-06-ino-1", agent: "milrinone", dose: 0.5 },
    ]
    p.support.icd = false
    Object.assign(p.function, { lvef: 20, nyha: null, peakVo2: null })
    Object.assign(p.labs, { creatinine: 0.5, egfr: null, hba1c: null })
    p.serology.cmvIgG = "negative"
    Object.assign(p.acceptance, { minDonorWeightKg: 14, maxDonorWeightKg: 50 })
    p.notes =
      "6-year-old with post-viral DCM on home-to-hospital milrinone. Isohemagglutinin titers 1:64/1:128, above the ABOi " +
      "threshold; family not consented for ABO-incompatible offers. Accept donors 14–50 kg."
  }),
  // 07 Grace Kim: HCM, end-stage, A recipient.
  base(6, (p) => {
    age(p, 47)
    p.listing.urgencyStatus = "A4"
    p.body = { heightCm: 160, weightKg: 56 }
    p.blood.abo = "A"
    Object.assign(p.diagnosis, {
      primary: "1201",
      detail:
        "End-stage (burned-out) hypertrophic cardiomyopathy, MYH7 variant",
    })
    p.function.lvef = 30
    p.notes =
      "End-stage HCM with LVEF 30% and recurrent VT despite amiodarone and two ablations. Small frame (56 kg). " +
      "Would consider single-vessel donor CAD after discussion; no multivessel disease."
  }),
  // 08 Mateo Silva: Impella 5.5, declines HCV-viremic and PHS-risk organs.
  base(7, (p) => {
    age(p, 39)
    p.listing.urgencyStatus = "A2"
    p.listing.statusCriterion = "Percutaneous endovascular MCSD"
    p.body = { heightCm: 177, weightKg: 79 }
    Object.assign(p.diagnosis, {
      primary: "1003",
      detail: "Familial dilated cardiomyopathy (LMNA)",
    })
    Object.assign(p.support, {
      device: "percutaneous",
      deviceBrand: "Impella 5.5 (axillary)",
      deviceImplantDate: daysAgo(11),
    })
    p.function.inIcu = true
    Object.assign(p.acceptance, {
      acceptHcvNat: false,
      acceptHcvAb: false,
      acceptPhsRisk: false,
    })
    p.notes =
      "LMNA cardiomyopathy, Impella 5.5 day 11, ambulating with PT. After counselling he declines HCV-viremic and PHS increased-risk " +
      "donors; documented in the consent form. Brother also LMNA-positive, followed in clinic."
  }),
  // 09 Hannah Lindqvist: ATTR amyloid with pulmonary hypertension.
  base(8, (p) => {
    age(p, 55)
    p.body = { heightCm: 166, weightKg: 64 }
    p.blood.abo = "AB"
    Object.assign(p.diagnosis, {
      primary: "1051",
      detail:
        "Transthyretin cardiac amyloidosis (wild-type), tafamidis since diagnosis",
    })
    Object.assign(p.hemodynamics, {
      paSystolic: 62,
      paDiastolic: 30,
      paMean: 41,
      pcwp: 18,
      cardiacOutput: 4.7,
      vasodilatorChallengeDone: false,
    })
    p.function.lvef = 40
    p.notes =
      "ATTR-wt cardiac amyloid, restrictive physiology, PVR ~4.9 WU on last cath (TPG 23). Nitroprusside challenge deferred " +
      "for hypotension. Surgeon prefers a donor heart at least recipient-sized for the RV."
  }),
  // 10 Omar Haddad: large recipient.
  base(9, (p) => {
    age(p, 62)
    p.body = { heightCm: 188, weightKg: 104 }
    p.blood.abo = "A"
    Object.assign(p.diagnosis, {
      primary: "1007",
      detail: "Ischemic cardiomyopathy, prior CABG x4",
    })
    Object.assign(p.history, {
      priorSternotomies: 1,
      priorCardiacSurgery: "CABG x4 (LIMA-LAD patent)",
      diabetes: "type2",
      smoking: "former",
      smokingQuitDate: daysAgo(5000),
    })
    p.notes =
      "Large recipient (188 cm, 104 kg, BMI 29). Prior CABG with patent LIMA; redo entry planned with femoral cannulation. " +
      "Undersized female donors unlikely to be suitable."
  }),
  // 11 Chloe Nguyen: petite candidate, peripartum cardiomyopathy.
  base(10, (p) => {
    age(p, 29)
    p.listing.urgencyStatus = "A6"
    p.listing.statusCriterion = "Listed, outpatient"
    p.body = { heightCm: 152, weightKg: 47 }
    Object.assign(p.diagnosis, {
      primary: "1002",
      detail: "Peripartum cardiomyopathy, persistent LVEF 20% at 2 years",
    })
    noInotropes(p)
    Object.assign(p.function, {
      lvef: 20,
      nyha: "III",
      peakVo2: 11.9,
      onBetaBlocker: true,
      hospitalized: false,
    })
    Object.assign(p.sensitization, { pregnancies: 1 })
    p.notes =
      "Outpatient, status 6. Petite (152 cm, 47 kg): large male donors will be oversized; check PHM on every offer. " +
      "cPRA 0% despite one pregnancy."
  }),
  // 12 Samuel Adeyemi: male recipient, open to female donors.
  base(11, (p) => {
    age(p, 50)
    p.body = { heightCm: 165, weightKg: 63 }
    Object.assign(p.diagnosis, {
      primary: "1053",
      detail: "Cardiac sarcoidosis with recurrent VT storms",
    })
    p.function.lvef = 25
    p.notes =
      "Cardiac sarcoid, VT storm x2 this year despite ablation and mexiletine. On prednisone 10 mg. " +
      "Open to female donors if PHM-matched."
  }),
  // 13 Isabel Costa: consented for HCV-viremic and PHS-risk donors.
  base(12, (p) => {
    age(p, 44)
    p.body = { heightCm: 172, weightKg: 78 }
    p.blood.abo = "B"
    Object.assign(p.diagnosis, {
      primary: "1001",
      detail: "Anthracycline cardiomyopathy after treatment for breast cancer",
    })
    Object.assign(p.history, {
      malignancyHistory: "yes",
      malignancyDetail:
        "Stage II breast cancer 2017, doxorubicin + trastuzumab; disease-free 8 years",
    })
    Object.assign(p.acceptance, {
      acceptHcvNat: true,
      acceptHcvAb: true,
      acceptAntiHbc: true,
      acceptPhsRisk: true,
    })
    p.notes =
      "Anthracycline CM, breast cancer in remission 8 yrs (oncology clearance on file). Consented for HCV-viremic, anti-HBc " +
      "and PHS increased-risk donors to widen the pool; ID aware, DAA access confirmed with pharmacy."
  }),
  // 14 Noah Fischer: older recipient, accepts older and anti-HBc donors.
  base(13, (p) => {
    age(p, 61)
    p.body = { heightCm: 180, weightKg: 86 }
    p.blood.abo = "A"
    Object.assign(p.diagnosis, {
      primary: "1000",
      detail: "Idiopathic dilated cardiomyopathy",
    })
    Object.assign(p.acceptance, { acceptAntiHbc: true })
    p.serology.cmvIgG = "positive"
    p.notes =
      "61-year-old with idiopathic DCM; open to donors up to age 60 and to isolated anti-HBc (HBV vaccinated, anti-HBs 140). " +
      "CMV seropositive."
  }),
  // 15 Leila Farahani: CMV-seronegative recipient.
  base(14, (p) => {
    age(p, 37)
    p.body = { heightCm: 170, weightKg: 68 }
    Object.assign(p.diagnosis, {
      primary: "1208",
      detail: "Arrhythmogenic cardiomyopathy (biventricular), DSP variant",
    })
    p.serology.cmvIgG = "negative"
    p.function.lvef = 22
    p.notes =
      "Biventricular ACM (DSP), RV failure on milrinone. CMV IgG negative: valganciclovir prophylaxis if a CMV D+ heart is accepted."
  }),
  // 16 Jacob Brennan
  base(15, (p) => {
    age(p, 45)
    p.body = { heightCm: 182, weightKg: 88 }
    p.blood.abo = "B"
    Object.assign(p.diagnosis, {
      primary: "1005",
      detail: "Alcohol-related dilated cardiomyopathy; abstinent 4 years",
    })
    Object.assign(p.history, {
      substanceUse: "no",
      psychosocialConcerns:
        "Alcohol use disorder in sustained remission; AA sponsor and addiction psychiatry follow-up",
    })
    p.notes =
      "Alcohol-related DCM, sober 4 yrs with negative PEth monthly. Milrinone-dependent. Psychosocial cleared by committee."
  }),
  // 17 Ava Patel: referred, under evaluation; ABO typing pending.
  base(16, (p) => {
    age(p, 33)
    p.listing.state = "evaluation"
    Object.assign(p.listing, {
      listingDate: "",
      urgencyStatus: null,
      statusCriterion: "",
      statusDate: "",
      statusExpiresOn: "",
    })
    p.body = { heightCm: 163, weightKg: 58 }
    Object.assign(p.blood, { abo: null, verifiedTwoSamples: false })
    Object.assign(p.diagnosis, {
      primary: "1004",
      detail: "Giant cell myocarditis on triple immunosuppression",
    })
    p.notes =
      "Transferred from outside hospital yesterday for transplant evaluation. Giant cell myocarditis. Type and screen drawn, " +
      "ABO not yet resulted from blood bank; second sample to follow. Not yet listed."
  }),
  // 18 Theo Novak
  base(17, (p) => {
    age(p, 40)
    p.body = { heightCm: 184, weightKg: 90 }
    Object.assign(p.diagnosis, {
      primary: "1000",
      detail: "Idiopathic dilated cardiomyopathy",
    })
    p.notes =
      "Idiopathic DCM, inotrope-dependent. Large frame; surgeon comfortable with mild donor LVH if angiogram is clean."
  }),
  // 19 Zara Mensah
  base(18, (p) => {
    age(p, 51)
    p.body = { heightCm: 168, weightKg: 70 }
    p.blood.abo = "A"
    Object.assign(p.diagnosis, {
      primary: "1202",
      detail: "Valvular cardiomyopathy after two mitral valve replacements",
    })
    Object.assign(p.history, {
      priorSternotomies: 2,
      priorCardiacSurgery: "MVR 2009, redo MVR 2019",
    })
    p.notes =
      "Redo x2 (MVR 2009, redo MVR 2019). On warfarin, reverse with 4F-PCC at call-in. LVEF 25%, milrinone-dependent."
  }),
  // 20 Henry Takahashi
  base(19, (p) => {
    age(p, 57)
    p.body = { heightCm: 171, weightKg: 72 }
    Object.assign(p.diagnosis, {
      primary: "1007",
      detail: "Ischemic cardiomyopathy",
    })
    Object.assign(p.history, {
      diabetes: "type2",
      smoking: "former",
      smokingQuitDate: daysAgo(4000),
    })
    p.notes =
      "Ischemic CM, inotrope-dependent, CKD 3a. Would accept extended-criteria donors after repeat echo."
  }),
  // 21 Lily Ortega: DCD-consented.
  base(20, (p) => {
    age(p, 26)
    p.body = { heightCm: 171, weightKg: 74 }
    Object.assign(p.diagnosis, {
      primary: "1206",
      detail:
        "Congenital: Ebstein anomaly without prior surgery, severe RV failure",
    })
    Object.assign(p.acceptance, { acceptDcd: true, maxDistanceNm: 1200 })
    p.notes =
      "Ebstein anomaly with RV failure. Consented for DCD hearts (DPP/OCS or TA-NRP). Accepts offers up to 1200 NM with OCS."
  }),
  // 22 Elijah Grant: temporarily inactive.
  base(21, (p) => {
    age(p, 48)
    p.listing.state = "inactive"
    p.body = { heightCm: 179, weightKg: 83 }
    Object.assign(p.diagnosis, {
      primary: "1000",
      detail: "Idiopathic dilated cardiomyopathy",
    })
    p.notes =
      "Made temporarily inactive 5 days ago for line-associated Staph epidermidis bacteremia; 14 days vancomycin. " +
      "Reactivate after negative surveillance cultures."
  }),
  // 23 Mila Kowalski: transplanted.
  base(22, (p) => {
    age(p, 59)
    p.listing.state = "transplanted"
    p.listing.statusDate = daysAgo(18)
    p.body = { heightCm: 165, weightKg: 69 }
    p.blood.abo = "A"
    Object.assign(p.diagnosis, {
      primary: "1051",
      detail:
        "AL amyloidosis after autologous stem-cell transplant, hematologic CR",
    })
    noInotropes(p)
    p.notes =
      "Transplanted 18 days ago (DBD donor, 3 h 40 min ischemic time). Uncomplicated course; first biopsy 0R. Off the list."
  }),
  // 24 Arjun Mehta: removed from list.
  base(23, (p) => {
    age(p, 66)
    p.listing.state = "removed"
    p.body = { heightCm: 174, weightKg: 70 }
    p.blood.abo = "B"
    Object.assign(p.diagnosis, {
      primary: "1007",
      detail: "Ischemic cardiomyopathy",
    })
    Object.assign(p.history, {
      frailty: "yes",
      diabetes: "type2",
      diabetesEndOrganDamage: true,
    })
    Object.assign(p.labs, { creatinine: 2.6, egfr: 24 })
    p.notes =
      "Removed from the list after committee review: progressive frailty and CKD 4. Transitioned to destination HeartMate 3 evaluation; " +
      "palliative care involved."
  }),
]
