import { describe, expect, it } from "vitest"
import { emptyDonor, emptyPatient, defaultPairInputs } from "../factories"
import { DEFAULT_CRITERIA } from "../criteria"
import type { Donor, Outcome } from "../schema"
import { evaluateDonorHeart } from "../rules/donor-heart"

function context() {
  const donor = emptyDonor()
  donor.identity.ageYears = 30
  Object.assign(donor.echo, {
    lvef: 60,
    septumMm: 10,
    posteriorWallMm: 10,
    wallMotion: "normal",
    valveDisease: "none",
    rvFunction: "normal",
    congenitalAbnormality: "no",
  })
  Object.assign(donor.history, {
    diabetes: "no",
    cigarettesOver20PackYears: "no",
    cocaine: "no",
    priorMi: "no",
    knownCad: "no",
    priorCardiacSurgery: "no",
    malignancyRisk: "none",
  })
  donor.coronary.coronaryAnomaly = "no"
  Object.assign(donor.ecg, { lvhCriteria: "no", ischemicChanges: "no" })
  donor.death.cardiacArrest = "no"
  Object.assign(donor.labs, {
    sodiumPeak: 145,
    sodiumLatest: 142,
    troponinIPeak: 0.1,
  })
  donor.hemodynamics.vasoactives = [
    { id: "va_test", agent: "norepinephrine", dose: 0.05 },
  ]
  const patient = emptyPatient()
  patient.identity.dateOfBirth = "1996-11-14"
  return {
    donor,
    patient,
    pair: defaultPairInputs(),
    criteria: structuredClone(DEFAULT_CRITERIA),
    now: new Date("2026-11-14T00:00:00Z"),
  }
}
const cases: Array<[string, (d: Donor) => void, Outcome]> = [
  [
    "age",
    (d) => {
      d.identity.ageYears = 50
    },
    "review",
  ],
  [
    "LVEF review",
    (d) => {
      d.echo.lvef = 45
    },
    "review",
  ],
  [
    "LVEF fail",
    (d) => {
      d.echo.lvef = 35
    },
    "fail",
  ],
  [
    "repeat LVEF",
    (d) => {
      d.echo.lvef = 35
      d.echo.repeatLvef = 55
    },
    "pass",
  ],
  [
    "wall review",
    (d) => {
      d.echo.septumMm = 15
    },
    "review",
  ],
  [
    "wall fail",
    (d) => {
      d.echo.posteriorWallMm = 18
    },
    "fail",
  ],
  [
    "valve",
    (d) => {
      d.echo.valveDisease = "moderate"
    },
    "fail",
  ],
  [
    "anomaly",
    (d) => {
      d.coronary.coronaryAnomaly = "yes"
    },
    "fail",
  ],
  [
    "multivessel",
    (d) => {
      d.coronary.angiography = "abnormal"
      d.coronary.vesselsOver50 = 2
    },
    "fail",
  ],
  [
    "single vessel",
    (d) => {
      d.coronary.angiography = "abnormal"
      d.coronary.vesselsOver50 = 1
    },
    "review",
  ],
  [
    "zero vessels",
    (d) => {
      d.coronary.angiography = "abnormal"
      d.coronary.vesselsOver50 = 0
    },
    "pass",
  ],
  [
    "left main",
    (d) => {
      d.coronary.angiography = "abnormal"
      d.coronary.leftMainDisease = true
    },
    "fail",
  ],
  [
    "angiography indicated",
    (d) => {
      d.identity.ageYears = 42
    },
    "review",
  ],
  [
    "sodium high",
    (d) => {
      d.labs.sodiumPeak = 171
    },
    "fail",
  ],
  [
    "sodium low",
    (d) => {
      d.labs.sodiumLatest = 127
    },
    "fail",
  ],
  [
    "sodium review",
    (d) => {
      d.labs.sodiumPeak = 160
    },
    "review",
  ],
  [
    "norepinephrine",
    (d) => {
      d.hemodynamics.vasoactives[0].dose = 0.2
    },
    "review",
  ],
  [
    "multiple agents",
    (d) => {
      d.hemodynamics.vasoactives.push({
        id: "va_2",
        agent: "dobutamine",
        dose: 5,
      })
    },
    "review",
  ],
  [
    "dopamine",
    (d) => {
      d.hemodynamics.vasoactives = [{ id: "va_2", agent: "dopamine", dose: 11 }]
    },
    "review",
  ],
  [
    "vasopressin excluded",
    (d) => {
      d.hemodynamics.vasoactives.push({
        id: "va_2",
        agent: "vasopressin",
        dose: 2,
      })
    },
    "pass",
  ],
  [
    "ECMO",
    (d) => {
      d.hemodynamics.ecmo = "va_ongoing"
    },
    "fail",
  ],
  [
    "arrest",
    (d) => {
      d.death.cardiacArrest = "yes"
      d.death.cprMinutes = 40
      d.echo.lvef = 45
    },
    "review",
  ],
  [
    "troponin",
    (d) => {
      d.labs.troponinIPeak = 2
    },
    "review",
  ],
  [
    "COHb",
    (d) => {
      d.death.carbonMonoxidePoisoning = true
      d.death.carboxyhemoglobinPct = 45
    },
    "fail",
  ],
  [
    "CO troponin",
    (d) => {
      d.death.carbonMonoxidePoisoning = true
      d.death.carboxyhemoglobinPct = 20
      d.labs.troponinIPeak = 0.7
    },
    "fail",
  ],
  [
    "CO ECG",
    (d) => {
      d.death.carbonMonoxidePoisoning = true
      d.ecg.ischemicChanges = "yes"
    },
    "fail",
  ],
  [
    "CO LVEF",
    (d) => {
      d.death.carbonMonoxidePoisoning = true
      d.echo.lvef = 45
    },
    "fail",
  ],
  [
    "malignancy high",
    (d) => {
      d.history.malignancyRisk = "high"
    },
    "fail",
  ],
  [
    "malignancy intermediate",
    (d) => {
      d.history.malignancyRisk = "intermediate"
    },
    "review",
  ],
  [
    "cocaine wall",
    (d) => {
      d.history.cocaine = "yes"
      d.echo.septumMm = 14
    },
    "review",
  ],
  [
    "sudden death",
    (d) => {
      d.death.unexplainedSuddenDeath = true
    },
    "review",
  ],
  [
    "wall motion",
    (d) => {
      d.echo.wallMotion = "segmental"
    },
    "review",
  ],
  [
    "RV",
    (d) => {
      d.echo.rvFunction = "moderate"
    },
    "review",
  ],
  [
    "congenital",
    (d) => {
      d.echo.congenitalAbnormality = "yes"
    },
    "review",
  ],
  [
    "known CAD",
    (d) => {
      d.history.knownCad = "yes"
    },
    "review",
  ],
  [
    "prior MI",
    (d) => {
      d.history.priorMi = "yes"
    },
    "review",
  ],
  [
    "prior surgery",
    (d) => {
      d.history.priorCardiacSurgery = "yes"
    },
    "review",
  ],
]
describe("donor heart", () => {
  it("passes a fully assessed normal donor", () => {
    expect(evaluateDonorHeart(context()).status).toBe("pass")
  })
  it.each(cases)("%s", (_, change, status) => {
    const ctx = context()
    change(ctx.donor)
    expect(evaluateDonorHeart(ctx).status).toBe(status)
  })
  const missingCases: Array<[string, (d: Donor) => void]> = [
    [
      "age",
      (d) => {
        d.identity.ageYears = null
      },
    ],
    [
      "LVEF",
      (d) => {
        d.echo.lvef = null
      },
    ],
    [
      "wall",
      (d) => {
        d.echo.septumMm = null
      },
    ],
    [
      "sodium",
      (d) => {
        d.labs.sodiumPeak = null
      },
    ],
    [
      "troponin",
      (d) => {
        d.labs.troponinIPeak = null
      },
    ],
    [
      "dose",
      (d) => {
        d.hemodynamics.vasoactives[0].dose = null
      },
    ],
    [
      "vessels",
      (d) => {
        d.coronary.angiography = "abnormal"
      },
    ],
    [
      "CPR",
      (d) => {
        d.death.cardiacArrest = "yes"
      },
    ],
    [
      "COHb",
      (d) => {
        d.death.carbonMonoxidePoisoning = true
      },
    ],
    [
      "malignancy",
      (d) => {
        d.history.malignancyRisk = "unknown"
      },
    ],
    [
      "cocaine",
      (d) => {
        d.history.cocaine = "unknown"
      },
    ],
    [
      "diabetes",
      (d) => {
        d.history.diabetes = "unknown"
      },
    ],
    [
      "smoking",
      (d) => {
        d.history.cigarettesOver20PackYears = "unknown"
      },
    ],
    [
      "arrest",
      (d) => {
        d.death.cardiacArrest = "unknown"
      },
    ],
    [
      "valve",
      (d) => {
        d.echo.valveDisease = "unknown"
      },
    ],
    [
      "motion",
      (d) => {
        d.echo.wallMotion = "unknown"
      },
    ],
    [
      "RV",
      (d) => {
        d.echo.rvFunction = "unknown"
      },
    ],
    [
      "anomaly",
      (d) => {
        d.coronary.coronaryAnomaly = "unknown"
      },
    ],
    [
      "congenital",
      (d) => {
        d.echo.congenitalAbnormality = "unknown"
      },
    ],
    [
      "MI",
      (d) => {
        d.history.priorMi = "unknown"
      },
    ],
    [
      "CAD",
      (d) => {
        d.history.knownCad = "unknown"
      },
    ],
    [
      "surgery",
      (d) => {
        d.history.priorCardiacSurgery = "unknown"
      },
    ],
    [
      "LVH",
      (d) => {
        d.ecg.lvhCriteria = "unknown"
      },
    ],
  ]
  it.each(missingCases)("missing %s never passes", (_, change) => {
    const ctx = context()
    change(ctx.donor)
    const result = evaluateDonorHeart(ctx)
    expect(result.status).toBe("review")
    expect(
      result.findings.some((f) => f.missing && f.status === "review")
    ).toBe(true)
  })
  it("honors patient and editable age limits", () => {
    const ctx = context()
    ctx.donor.identity.ageYears = 50
    ctx.patient.acceptance.maxDonorAge = 45
    expect(evaluateDonorHeart(ctx).status).toBe("fail")
    ctx.patient.acceptance.maxDonorAge = null
    ctx.criteria.donor.ageFailAbove = 48
    expect(evaluateDonorHeart(ctx).status).toBe("fail")
  })
  it("emits older donor information without worsening status", () => {
    const ctx = context()
    ctx.donor.identity.ageYears = 52
    ctx.donor.coronary.angiography = "normal"
    ctx.criteria.donor.ageReviewAbove = 60
    const r = evaluateDonorHeart(ctx)
    expect(r.status).toBe("pass")
    expect(r.findings).toContainEqual(
      expect.objectContaining({
        code: "donorHeart.olderDonorYoungerRecipient",
        status: "info",
      })
    )
  })
  it("notes initial LVEF when using repeat", () => {
    const ctx = context()
    ctx.donor.echo.lvef = 35
    ctx.donor.echo.repeatLvef = 55
    expect(evaluateDonorHeart(ctx).findings).toContainEqual(
      expect.objectContaining({
        status: "info",
        evidence: expect.stringContaining("35"),
      })
    )
  })
  it("honors configurable valve and CAD outcomes", () => {
    const ctx = context()
    ctx.donor.echo.valveDisease = "moderate"
    ctx.criteria.donor.moderateValveOutcome = "pass"
    expect(evaluateDonorHeart(ctx).status).toBe("pass")
    ctx.donor.coronary.angiography = "abnormal"
    ctx.donor.coronary.vesselsOver50 = 2
    ctx.criteria.donor.multivesselCadOutcome = "review"
    expect(evaluateDonorHeart(ctx).status).toBe("review")
  })
})

// These cases detect accidental hard-coded defaults after criteria editing.
describe("donor heart editable thresholds", () => {
  const edits: Array<
    [string, (ctx: ReturnType<typeof context>) => void, Outcome]
  > = [
    [
      "LVEF pass",
      (ctx) => {
        ctx.criteria.donor.lvefPassMin = 65
      },
      "review",
    ],
    [
      "LVEF fail",
      (ctx) => {
        ctx.criteria.donor.lvefReviewMin = 65
        ctx.criteria.donor.lvefPassMin = 70
      },
      "fail",
    ],
    [
      "wall pass",
      (ctx) => {
        ctx.criteria.donor.wallThicknessPassMax = 9
      },
      "review",
    ],
    [
      "wall fail",
      (ctx) => {
        ctx.criteria.donor.wallThicknessPassMax = 8
        ctx.criteria.donor.wallThicknessReviewMax = 9
      },
      "fail",
    ],
    [
      "sodium low fail",
      (ctx) => {
        ctx.criteria.donor.sodiumFailBelow = 143
      },
      "fail",
    ],
    [
      "sodium high fail",
      (ctx) => {
        ctx.criteria.donor.sodiumFailAtOrAbove = 145
      },
      "fail",
    ],
    [
      "sodium low review",
      (ctx) => {
        ctx.criteria.donor.sodiumReviewBelow = 143
      },
      "review",
    ],
    [
      "sodium high review",
      (ctx) => {
        ctx.criteria.donor.sodiumReviewAbove = 144
      },
      "review",
    ],
    [
      "norepinephrine",
      (ctx) => {
        ctx.criteria.donor.norepinephrineMaxAlone = 0.04
      },
      "review",
    ],
    [
      "agent count",
      (ctx) => {
        ctx.criteria.donor.vasoactiveAgentsReviewMin = 1
      },
      "review",
    ],
    [
      "troponin",
      (ctx) => {
        ctx.criteria.donor.troponinIReviewAbove = 0.05
      },
      "review",
    ],
    [
      "male angiography",
      (ctx) => {
        ctx.criteria.donor.angioAgeMale = 29
      },
      "review",
    ],
    [
      "female angiography",
      (ctx) => {
        ctx.donor.identity.sex = "female"
        ctx.criteria.donor.angioAgeFemale = 29
      },
      "review",
    ],
    [
      "dopamine",
      (ctx) => {
        ctx.donor.hemodynamics.vasoactives = [
          { id: "va_test", agent: "dopamine", dose: 5 },
        ]
        ctx.criteria.donor.dopamineReviewAbove = 4
      },
      "review",
    ],
    [
      "single vessel",
      (ctx) => {
        ctx.donor.coronary.angiography = "abnormal"
        ctx.donor.coronary.vesselsOver50 = 1
        ctx.criteria.donor.singleVesselCadOutcome = "fail"
      },
      "fail",
    ],
    [
      "COHb",
      (ctx) => {
        ctx.donor.death.carbonMonoxidePoisoning = true
        ctx.donor.death.carboxyhemoglobinPct = 35
        ctx.criteria.donor.coHbFailAbove = 30
      },
      "fail",
    ],
    [
      "CO troponin",
      (ctx) => {
        ctx.donor.death.carbonMonoxidePoisoning = true
        ctx.donor.death.carboxyhemoglobinPct = 20
        ctx.criteria.donor.coTroponinFailAtOrAbove = 0.1
      },
      "fail",
    ],
  ]
  it.each(edits)("uses edited %s threshold", (_, edit, expected) => {
    const ctx = context()
    edit(ctx)
    expect(evaluateDonorHeart(ctx).status).toBe(expected)
  })
  it("retains a failing known wall while the other is missing", () => {
    const ctx = context()
    ctx.donor.echo.septumMm = null
    ctx.donor.echo.posteriorWallMm = 18
    const r = evaluateDonorHeart(ctx)
    expect(r.status).toBe("fail")
    expect(r.findings.some((f) => f.missing)).toBe(true)
  })
  it("CPR boundary uses edited duration and repeat LVEF", () => {
    const ctx = context()
    ctx.donor.death.cardiacArrest = "yes"
    ctx.donor.death.cprMinutes = 31
    ctx.donor.echo.lvef = 45
    ctx.criteria.donor.cprMinutesReview = 35
    expect(
      evaluateDonorHeart(ctx).findings.some(
        (f) => f.code === "donorHeart.cprMinutes"
      )
    ).toBe(false)
    ctx.criteria.donor.cprMinutesReview = 30
    expect(evaluateDonorHeart(ctx).findings).toContainEqual(
      expect.objectContaining({
        code: "donorHeart.cprMinutes",
        status: "review",
      })
    )
    ctx.donor.echo.repeatLvef = 55
    expect(evaluateDonorHeart(ctx).status).toBe("pass")
  })
  it("provides complete explanations for every finding", () => {
    const ctx = context()
    for (const [_, change] of cases) {
      const individual = structuredClone(ctx)
      change(individual.donor)
      for (const f of evaluateDonorHeart(individual).findings) {
        expect(f.code).toMatch(/^donorHeart\./)
        expect(f.title.length).toBeGreaterThan(0)
        expect(f.detail.length).toBeGreaterThan(0)
        expect(f.source.length).toBeGreaterThan(0)
        if (!f.missing) expect(f.evidence.length).toBeGreaterThan(0)
      }
    }
  })
})

describe("diabetes coronary screening", () => {
  it.each(["0-5", "6-10", ">10", "yes_unknown"] as const)(
    "requires missing angiography review for diabetes duration %s",
    (duration) => {
      const ctx = context()
      ctx.donor.history.diabetes = duration
      const result = evaluateDonorHeart(ctx)
      expect(result.status).toBe("review")
      expect(result.findings).toContainEqual(
        expect.objectContaining({
          code: "donorHeart.angiographyIndicated",
          status: "review",
          missing: true,
        })
      )
    }
  )
  it("does not request missing angiography when a diabetic donor has normal angiography", () => {
    const ctx = context()
    ctx.donor.history.diabetes = "0-5"
    ctx.donor.coronary.angiography = "normal"
    const result = evaluateDonorHeart(ctx)
    expect(result.status).toBe("pass")
    expect(
      result.findings.some((f) => f.code === "donorHeart.angiographyIndicated")
    ).toBe(false)
  })
})
