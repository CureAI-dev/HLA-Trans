import { emptyDonor } from "../factories"
import { DONOR_TEST_VALUES } from "../options"
import type { Donor } from "../schema"
import {
  DONOR_HOSPITALS,
  OPOS,
  daysAgo,
  demoNow,
  stampDaysAgo,
  typing,
} from "./people"

const CODES = [
  "AHFK214",
  "BQRT507",
  "CLMV382",
  "DXNP619",
  "EKSW145",
  "FJTB873",
  "GRHZ526",
  "HVLC094",
  "JMQD731",
  "KPWX268",
  "LNBT450",
  "MZRF903",
] as const

/**
 * Fully recorded, unremarkable DBD donor: required serology resulted and
 * negative (EBV IgG positive, as in most adults), stable on low-dose
 * vasopressin, normal echo and ECG. Each donor then applies its own case.
 */
function base(i: number, overrides: (d: Donor) => void): Donor {
  const d = emptyDonor(demoNow())
  const referral = 1 + (i % 3)
  d.id = `demo-donor-${String(i + 1).padStart(2, "0")}`
  d.createdAt = stampDaysAgo(referral)
  d.updatedAt = stampDaysAgo(0.1 + (i % 4) * 0.05)
  Object.assign(d.identity, {
    donorId: CODES[i],
    state: "available",
    donorHospital: DONOR_HOSPITALS[i % DONOR_HOSPITALS.length],
    opo: OPOS[i % OPOS.length],
    referralDate: daysAgo(referral),
    ageYears: 30,
    sex: "male",
    ethnicity: "white",
  })
  d.body = { heightCm: 178, weightKg: 80 }
  Object.assign(d.blood, {
    abo: "O",
    subtype: "none",
    verifiedTwoSamples: true,
  })
  Object.assign(d.donation, { type: "dbd", brainDeathDate: daysAgo(1) })
  Object.assign(d.death, {
    cause: "3",
    mechanism: "9",
    circumstance: "1",
    carbonMonoxidePoisoning: false,
    carboxyhemoglobinPct: null,
    cardiacArrest: "no",
    cprMinutes: null,
    unexplainedSuddenDeath: false,
  })
  Object.assign(d.history, {
    hypertension: "no",
    diabetes: "no",
    insulinDependent: false,
    cigarettesOver20PackYears: "no",
    cocaine: "no",
    amphetamines: "no",
    ivDrugUse: "no",
    heavyAlcohol: "no",
    priorMi: "no",
    knownCad: "no",
    priorCardiacSurgery: "no",
    malignancyRisk: "none",
    malignancyDetail: "",
    transfusionsThisAdmission: "1-5",
    bornInChagasEndemicCountry: "no",
    phsRiskCriteria: [],
  })
  Object.assign(d.hemodynamics, {
    heartRate: 92,
    systolicBp: 118,
    meanArterialPressure: 78,
    cvp: 8,
    pcwp: null,
    cardiacIndex: null,
    cardiacOutput: null,
    temperatureC: 36.6,
    vasoactives: [{ id: `${d.id}-va-1`, agent: "vasopressin", dose: 2.4 }],
    thyroidHormone: true,
    steroids: true,
    ecmo: "none",
  })
  Object.assign(d.echo, {
    echoDate: daysAgo(1),
    lvef: 60,
    lvefMethod: "echo",
    repeatLvef: null,
    septumMm: 10,
    posteriorWallMm: 9,
    wallMotion: "normal",
    valveDisease: "none",
    rvFunction: "normal",
    congenitalAbnormality: "no",
  })
  Object.assign(d.coronary, {
    angiography: "not_done",
    vesselsOver50: null,
    leftMainDisease: false,
    coronaryAnomaly: "no",
  })
  Object.assign(d.ecg, {
    lvhCriteria: "no",
    ischemicChanges: "no",
    significantArrhythmia: "no",
    qtcMs: 438,
  })
  Object.assign(d.labs, {
    sodiumPeak: 149,
    sodiumLatest: 143,
    troponinIPeak: 0.06,
    troponinTPeak: null,
    ckMb: 3.1,
    bnp: 88,
    creatinine: 0.9,
    lactate: 1.4,
    ph: 7.41,
    pao2: 412,
    fio2: 40,
    hemoglobin: 11.8,
    glucose: 154,
    ast: 38,
    alt: 31,
    bilirubin: 0.7,
  })
  for (const t of DONOR_TEST_VALUES) d.infection.serology[t] = "negative"
  d.infection.serology.ebvIgG = "positive"
  Object.assign(d.infection, {
    sampleDrawnWithin96h: true,
    bloodCulturePositive: "no",
    bloodCultureTargetedTherapy: false,
    cnsInfection: "none",
    chestXray: "normal",
  })
  d.hla = typing(
    {
      A: "A*02:01 A*03:01",
      B: "B*07:02 B*08:01",
      C: "C*07:02 C*07:01",
      DRB1: "DRB1*01:01 DRB1*04:01",
      DRB345: "DRB4*01:03",
      DQA1: "DQA1*01:01 DQA1*03:01",
      DQB1: "DQB1*05:01 DQB1*03:02",
      DPA1: "DPA1*01:03 DPA1*02:01",
      DPB1: "DPB1*04:01 DPB1*04:02",
    },
    daysAgo(1)
  )
  d.notes = ""
  overrides(d)
  return d
}

/** Built per call: Workers forbid crypto.randomUUID() and freeze Date at module scope. */
export const demoDonors = (): Donor[] => [
  // 01: the reference offer. Young DBD trauma donor, everything resulted and normal.
  base(0, (d) => {
    Object.assign(d.identity, { ageYears: 26, ethnicity: "white" })
    d.body = { heightCm: 176, weightKg: 76 }
    d.notes =
      "26M, MVC with isolated severe TBI, BD declared yesterday 14:10. No arrest. TTE: LVEF 60%, normal valves, no LVH. " +
      "Vasopressin 2.4 u/h only, on T4 and methylpred. Trop I peak 0.06. Serologies all negative, CMV IgG neg. Cultures NGTD."
  }),
  // 02: older donor (54), A, isolated anti-HBc, CMV positive. Angiogram clean.
  base(1, (d) => {
    Object.assign(d.identity, { ageYears: 54, sex: "male", ethnicity: "black" })
    d.body = { heightCm: 181, weightKg: 88 }
    d.blood.abo = "A"
    Object.assign(d.death, { cause: "2", mechanism: "11", circumstance: "6" })
    d.history.hypertension = "6-10"
    Object.assign(d.coronary, { angiography: "normal", vesselsOver50: 0 })
    d.echo.septumMm = 12
    d.echo.posteriorWallMm = 11
    Object.assign(d.infection.serology, {
      antiHbc: "positive",
      cmvIgG: "positive",
    })
    d.hla = typing(
      {
        A: "A*30:01 A*68:01",
        B: "B*42:01 B*53:01",
        C: "C*17:01 C*04:01",
        DRB1: "DRB1*03:02 DRB1*13:01",
        DRB345: "DRB3*01:01 DRB3*02:02",
        DQA1: "DQA1*04:01 DQA1*01:03",
        DQB1: "DQB1*04:02 DQB1*06:03",
        DPA1: "DPA1*02:02 DPA1*01:03",
        DPB1: "DPB1*01:01 DPB1*04:01",
      },
      daysAgo(2)
    )
    d.notes =
      "54M, spontaneous ICH, HTN on 2 agents x8 yrs. Cath today: no CAD, LVEDP 12. TTE LVEF 58%, septum 12 mm. " +
      "Isolated total anti-HBc positive (HBsAg and HBV NAT negative). CMV IgG positive. Best suited to an older recipient."
  }),
  // 03: arrest donor; repeat echo shows recovery (stunned myocardium). CMV positive.
  base(2, (d) => {
    Object.assign(d.identity, {
      ageYears: 23,
      sex: "male",
      ethnicity: "hispanic",
    })
    d.body = { heightCm: 172, weightKg: 70 }
    Object.assign(d.death, {
      cause: "1",
      mechanism: "3",
      circumstance: "5",
      cardiacArrest: "yes",
      cprMinutes: 22,
    })
    Object.assign(d.echo, { lvef: 38, repeatLvef: 55, wallMotion: "normal" })
    d.labs.troponinIPeak = 0.84
    d.history.bornInChagasEndemicCountry = "yes"
    Object.assign(d.infection.serology, {
      cmvIgG: "positive",
      chagas: "negative",
    })
    d.hla = typing(
      {
        A: "A*24:02 A*31:01",
        B: "B*35:01 B*39:05",
        C: "C*04:01 C*07:02",
        DRB1: "DRB1*04:07 DRB1*08:02",
        DRB345: "DRB4*01:01",
        DQA1: "DQA1*03:01 DQA1*04:01",
        DQB1: "DQB1*03:02 DQB1*04:02",
        DPA1: "DPA1*01:03 DPA1*02:01",
        DPB1: "DPB1*04:01 DPB1*13:01",
      },
      daysAgo(2)
    )
    d.notes =
      "23M, opioid overdose found down, witnessed arrest with 22 min CPR to ROSC. Initial TTE LVEF 38% with global hypokinesis; " +
      "repeat echo day 2 after volume optimisation and T4 improved LVEF 38%→55%, normal wall motion. Trop I peaked 0.84, now trending down. " +
      "Born in El Salvador; T. cruzi antibody negative. CMV IgG positive. No PHS criteria on social history interview with mother."
  }),
  // 04: two pressors at high dose; B; carries A24 (DSA target for a sensitized B candidate).
  base(3, (d) => {
    Object.assign(d.identity, { ageYears: 37, sex: "male", ethnicity: "white" })
    d.body = { heightCm: 183, weightKg: 91 }
    d.blood.abo = "B"
    d.hemodynamics.meanArterialPressure = 64
    d.hemodynamics.vasoactives = [
      { id: "demo-donor-04-va-1", agent: "norepinephrine", dose: 0.18 },
      { id: "demo-donor-04-va-2", agent: "dopamine", dose: 12 },
      { id: "demo-donor-04-va-3", agent: "vasopressin", dose: 2.4 },
    ]
    d.labs.sodiumPeak = 154
    d.hla = typing(
      {
        A: "A*24:02 A*01:01",
        B: "B*08:01 B*44:02",
        C: "C*07:01 C*05:01",
        DRB1: "DRB1*03:01 DRB1*04:01",
        DRB345: "DRB3*01:01 DRB4*01:03",
        DQA1: "DQA1*05:01 DQA1*03:01",
        DQB1: "DQB1*02:01 DQB1*03:01",
        DPA1: "DPA1*01:03",
        DPB1: "DPB1*04:01 DPB1*03:01",
      },
      daysAgo(1)
    )
    d.notes =
      "37M, fall from ladder, BD this morning. Labile after declaration: norepi 0.18 + dopamine 12 + vasopressin. " +
      "OPO up-titrating T4 and steroids, goal MAP >65; repeat echo planned once weaned. TTE LVEF 55%. Typing includes A24."
  }),
  // 05: female, A2 subtype, single-vessel CAD on cath; small donor.
  base(4, (d) => {
    Object.assign(d.identity, {
      ageYears: 49,
      sex: "female",
      ethnicity: "white",
    })
    d.body = { heightCm: 158, weightKg: 54 }
    Object.assign(d.blood, { abo: "A", subtype: "A2" })
    Object.assign(d.death, { cause: "2", mechanism: "11", circumstance: "6" })
    Object.assign(d.history, {
      hypertension: "0-5",
      cigarettesOver20PackYears: "yes",
    })
    Object.assign(d.coronary, {
      angiography: "abnormal",
      vesselsOver50: 1,
      leftMainDisease: false,
    })
    d.infection.serology.cmvIgG = "positive"
    d.hla = typing(
      {
        A: "A*01:01 A*11:01",
        B: "B*57:01 B*35:01",
        C: "C*06:02 C*04:01",
        DRB1: "DRB1*07:01 DRB1*11:01",
        DRB345: "DRB3*02:02 DRB4*01:01",
        DQA1: "DQA1*02:01 DQA1*05:05",
        DQB1: "DQB1*03:03 DQB1*03:01",
        DPA1: "DPA1*01:03",
        DPB1: "DPB1*04:01 DPB1*02:01",
      },
      daysAgo(3)
    )
    d.notes =
      "49F, SAH (Hunt-Hess 5), 30 pack-yr smoker. Blood group A2 (subtyped by OPO lab). Cath: 60% mid-LAD lesion, otherwise smooth; " +
      "no left main disease. TTE LVEF 62%. Small donor (54 kg); size carefully for male recipients."
  }),
  // 06: HCV viremic with PHS risk (injection drug use), O.
  base(5, (d) => {
    Object.assign(d.identity, { ageYears: 32, sex: "male", ethnicity: "white" })
    d.body = { heightCm: 180, weightKg: 77 }
    Object.assign(d.death, {
      cause: "1",
      mechanism: "3",
      circumstance: "5",
      cardiacArrest: "yes",
      cprMinutes: 9,
    })
    Object.assign(d.history, {
      ivDrugUse: "yes",
      phsRiskCriteria: ["idu", "incarceration"],
    })
    Object.assign(d.infection.serology, {
      antiHcv: "positive",
      hcvNat: "positive",
    })
    d.hla = typing(
      {
        A: "A*02:01 A*26:01",
        B: "B*51:01 B*18:01",
        C: "C*15:02 C*12:03",
        DRB1: "DRB1*11:04 DRB1*16:01",
        DRB345: "DRB3*02:02 DRB5*02:02",
        DQA1: "DQA1*05:05 DQA1*01:02",
        DQB1: "DQB1*03:01 DQB1*05:02",
        DPA1: "DPA1*01:03",
        DPB1: "DPB1*04:01 DPB1*02:01",
      },
      daysAgo(2)
    )
    d.notes =
      "32M, fentanyl overdose, 9 min bystander CPR. Anti-HCV and HCV RNA positive (viral load 1.2 million IU/mL, genotype 1a). " +
      "PHS increased-risk: IVDU within 30 days, incarcerated >72 h this year. HIV and HBV NAT negative. TTE LVEF 63%. " +
      "Offer only to candidates consented for HCV-viremic and PHS-risk organs; 12 weeks glecaprevir/pibrentasvir post-op."
  }),
  // 07: cocaine use with LVH; angiogram normal; O.
  base(6, (d) => {
    Object.assign(d.identity, { ageYears: 31, sex: "male", ethnicity: "black" })
    d.body = { heightCm: 185, weightKg: 92 }
    Object.assign(d.death, { cause: "3", mechanism: "7", circumstance: "3" })
    d.history.cocaine = "yes"
    d.history.heavyAlcohol = "yes"
    Object.assign(d.echo, { septumMm: 14, posteriorWallMm: 13 })
    d.ecg.lvhCriteria = "yes"
    Object.assign(d.coronary, { angiography: "normal", vesselsOver50: 0 })
    d.hla = typing(
      {
        A: "A*30:02 A*74:01",
        B: "B*58:02 B*45:01",
        C: "C*06:02 C*16:01",
        DRB1: "DRB1*15:03 DRB1*13:02",
        DRB345: "DRB3*03:01 DRB5*01:01",
        DQA1: "DQA1*01:02",
        DQB1: "DQB1*06:02 DQB1*06:09",
        DPA1: "DPA1*02:01 DPA1*01:03",
        DPB1: "DPB1*01:01 DPB1*17:01",
      },
      daysAgo(1)
    )
    d.notes =
      "31M, GSW head. Daily cocaine per family, last use 2 days before admission; heavy EtOH. Utox positive for cocaine. " +
      "TTE LVEF 58%, septum 14 mm, posterior wall 13 mm; ECG meets LVH voltage. Cath clean. Discuss LVH with surgeon before accepting."
  }),
  // 08: CO poisoning with myocardial injury; declined by all programs.
  base(7, (d) => {
    Object.assign(d.identity, {
      ageYears: 41,
      sex: "male",
      ethnicity: "asian",
      state: "declined",
    })
    d.body = { heightCm: 170, weightKg: 72 }
    d.blood.abo = "A"
    Object.assign(d.death, {
      cause: "1",
      mechanism: "4",
      circumstance: "2",
      carbonMonoxidePoisoning: true,
      carboxyhemoglobinPct: 44,
      cardiacArrest: "no",
    })
    Object.assign(d.coronary, { angiography: "normal", vesselsOver50: 0 })
    d.labs.troponinIPeak = 0.92
    d.echo.lvef = 52
    d.hla = typing(
      {
        A: "A*33:03 A*11:01",
        B: "B*58:01 B*46:01",
        C: "C*03:02 C*01:02",
        DRB1: "DRB1*03:01 DRB1*09:01",
        DRB345: "DRB3*01:01 DRB4*01:03",
        DQA1: "DQA1*05:01 DQA1*03:02",
        DQB1: "DQB1*02:01 DQB1*03:03",
        DPA1: "DPA1*02:02",
        DPB1: "DPB1*05:01 DPB1*02:01",
      },
      daysAgo(2)
    )
    d.notes =
      "41M, intentional CO inhalation (vehicle). Arrival COHb 44% before hyperbaric O2. Trop I peaked 0.92. TTE LVEF 52%, " +
      "mild inferior hypokinesis resolved on repeat. Cath normal. Declined by all programs on the match run; kept for the record."
  }),
  // 09: female, prolonged CPR, LVEF 46%.
  base(8, (d) => {
    Object.assign(d.identity, {
      ageYears: 36,
      sex: "female",
      ethnicity: "white",
    })
    d.body = { heightCm: 170, weightKg: 70 }
    Object.assign(d.death, {
      cause: "1",
      mechanism: "4",
      circumstance: "6",
      cardiacArrest: "yes",
      cprMinutes: 38,
    })
    Object.assign(d.echo, { lvef: 46, wallMotion: "global" })
    d.labs.troponinIPeak = 2.4
    d.infection.serology.cmvIgG = "positive"
    d.hla = typing(
      {
        A: "A*02:01 A*29:02",
        B: "B*44:03 B*15:01",
        C: "C*16:01 C*03:04",
        DRB1: "DRB1*07:01 DRB1*15:01",
        DRB345: "DRB4*01:01 DRB5*01:01",
        DQA1: "DQA1*02:01 DQA1*01:02",
        DQB1: "DQB1*02:02 DQB1*06:02",
        DPA1: "DPA1*01:03",
        DPB1: "DPB1*04:01",
      },
      daysAgo(1)
    )
    d.notes =
      "36F, status asthmaticus, out-of-hospital arrest, 38 min CPR (2 shocks). TTE LVEF 46% with global hypokinesis on day 1; " +
      "Trop I 2.4. Repeat echo requested at 24 h on low-dose dobutamine before any acceptance. CMV IgG positive."
  }),
  // 10: DCD, direct procurement onto OCS.
  base(9, (d) => {
    Object.assign(d.identity, {
      ageYears: 29,
      sex: "male",
      ethnicity: "hispanic",
    })
    d.body = { heightCm: 175, weightKg: 74 }
    Object.assign(d.donation, {
      type: "dcd",
      brainDeathDate: "",
      dcdRecovery: "dpp",
      agonalPhaseMinutes: 26,
      functionalWarmIschemiaMinutes: 21,
      noTouchMinutes: 5,
    })
    Object.assign(d.death, { cause: "1", mechanism: "1", circumstance: "5" })
    d.hla = typing(
      {
        A: "A*02:01 A*68:01",
        B: "B*39:01 B*40:02",
        C: "C*07:02 C*03:04",
        DRB1: "DRB1*04:07 DRB1*14:02",
        DRB345: "DRB3*01:01 DRB4*01:01",
        DQA1: "DQA1*03:01 DQA1*05:03",
        DQB1: "DQB1*03:02 DQB1*03:01",
        DPA1: "DPA1*01:03",
        DPB1: "DPB1*04:02 DPB1*04:01",
      },
      daysAgo(1)
    )
    d.notes =
      "29M, drowning with anoxic brain injury, not BD; family consented to DCD. Withdrawal in OR tonight 20:00. " +
      "Estimated fWIT ~21 min from agonal-phase modelling (agonal 26 min, 5 min no-touch). DPP onto OCS planned; " +
      "lactate trend on the rig will guide final acceptance."
  }),
  // 11: pediatric donor, A, 14 months.
  base(10, (d) => {
    Object.assign(d.identity, {
      ageYears: 1,
      sex: "female",
      ethnicity: "multiracial",
    })
    d.body = { heightCm: 76, weightKg: 9.8 }
    d.blood.abo = "A"
    Object.assign(d.death, { cause: "1", mechanism: "4", circumstance: "5" })
    d.labs = { ...d.labs, creatinine: 0.3, hemoglobin: 10.4 }
    d.infection.serology.ebvIgG = "negative"
    d.hemodynamics = {
      ...d.hemodynamics,
      heartRate: 128,
      systolicBp: 88,
      meanArterialPressure: 62,
      cvp: 6,
      vasoactives: [
        { id: "demo-donor-11-va-1", agent: "vasopressin", dose: 0.3 },
      ],
    }
    d.echo.septumMm = 4
    d.echo.posteriorWallMm = 4
    d.echo.lvef = 65
    d.hla = typing(
      {
        A: "A*01:01 A*03:01",
        B: "B*08:01 B*07:02",
        C: "C*07:01 C*07:02",
        DRB1: "DRB1*03:01 DRB1*15:01",
        DRB345: "DRB3*01:01 DRB5*01:01",
        DQA1: "DQA1*05:01 DQA1*01:02",
        DQB1: "DQB1*02:01 DQB1*06:02",
        DPA1: "DPA1*01:03",
        DPB1: "DPB1*04:01 DPB1*02:01",
      },
      daysAgo(1)
    )
    d.notes =
      "14-month-old F, accidental asphyxiation at home, BD per pediatric criteria. 9.8 kg. TTE normal structure, LVEF 65%, " +
      "no shunt. On low-dose vasopressin. EBV and CMV seronegative. Suitable for infants and small children."
  }),
  // 12: late referral, work-up incomplete: typing, height and two required tests pending.
  base(11, (d) => {
    Object.assign(d.identity, {
      ageYears: 33,
      sex: "male",
      ethnicity: "aian",
      referralDate: daysAgo(0),
    })
    d.createdAt = stampDaysAgo(0.2)
    d.body = { heightCm: null, weightKg: 79 }
    Object.assign(d.infection.serology, {
      hcvNat: "not_done",
      strongyloides: "not_done",
    })
    d.hla = typing(
      {
        A: "",
        B: "",
        C: "",
        DRB1: "",
        DRB345: "",
        DQA1: "",
        DQB1: "",
        DPA1: "",
        DPB1: "",
      },
      "",
      ""
    )
    d.notes =
      "33M, MVC, BD declared 2 h ago at outside hospital. Height not yet documented by the OPO (weight from bed scale). " +
      "HLA typing in progress, ETA 6 h. HCV NAT and Strongyloides Ab sent, pending. TTE LVEF 60%. Do not accept before results."
  }),
]
