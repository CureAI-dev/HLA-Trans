import { describe, expect, test } from "vitest"
import * as c from "../calc"
import { defaultPairInputs, emptyPatient } from "../factories"
import type { Criteria, Patient } from "../schema"

const logistics: Criteria["logistics"] = {
  ischemicPassMaxMinutes: 240,
  ischemicReviewMaxMinutes: 360,
  olderDonorAge: 45,
  dcdFwitPassMaxMinutes: 30,
  dcdFwitReviewMaxMinutes: 45,
  redoSternotomyExtraMinutes: 45,
  deviceExplantExtraMinutes: 60,
}

describe("PHM (Reed 2014 worked example)", () => {
  test("male 55y 175cm 80kg", () => {
    const r = c.predictedHeartMass({ sex: "male", ageYears: 55, heightCm: 175, weightKg: 80 })!
    expect(r.lv).toBeCloseTo(161.65, 1)
    expect(r.rv).toBeCloseTo(23.42, 1)
    expect(r.total).toBeCloseTo(185.07, 1)
  })

  test("female 55y 175cm 80kg", () => {
    const r = c.predictedHeartMass({ sex: "female", ageYears: 55, heightCm: 175, weightKg: 80 })!
    expect(r.lv).toBeCloseTo(133.63, 1)
    expect(r.rv).toBeCloseTo(22.04, 1)
    expect(r.total).toBeCloseTo(155.68, 1)
  })

  test("missing or zero inputs return null", () => {
    expect(c.predictedHeartMass({ sex: "male", ageYears: null, heightCm: 175, weightKg: 80 })).toBeNull()
    expect(c.predictedHeartMass({ sex: "male", ageYears: 0, heightCm: 175, weightKg: 80 })).toBeNull()
    expect(c.predictedHeartMass({ sex: "male", ageYears: 55, heightCm: null, weightKg: 80 })).toBeNull()
    expect(c.predictedHeartMass({ sex: "male", ageYears: 55, heightCm: 175, weightKg: 0 })).toBeNull()
  })
})

describe("BSA and BMI", () => {
  test("Mosteller 180/80 = 2.0", () => expect(c.bsaMosteller(180, 80)).toBeCloseTo(2.0, 3))
  test("DuBois 180/80", () => expect(c.bsaDuBois(180, 80)).toBeCloseTo(1.9964, 3))
  test("BMI 180/81 = 25.0", () => expect(c.bmi(180, 81)).toBeCloseTo(25.0, 2))
  test("missing inputs return null", () => {
    expect(c.bmi(null, 80)).toBeNull()
    expect(c.bsaMosteller(180, null)).toBeNull()
    expect(c.bsaDuBois(0, 80)).toBeNull()
  })
  test("BMI category boundaries", () => {
    expect(c.bmiCategory(18.49)).toBe("Underweight")
    expect(c.bmiCategory(18.5)).toBe("Normal")
    expect(c.bmiCategory(25)).toBe("Overweight")
    expect(c.bmiCategory(30)).toBe("Obesity class I")
    expect(c.bmiCategory(35)).toBe("Obesity class II")
    expect(c.bmiCategory(40)).toBe("Obesity class III")
    expect(c.bmiCategory(null)).toBeNull()
  })
})

describe("age", () => {
  test("birthday not yet reached", () =>
    expect(c.ageInYears("1980-06-15", new Date("2026-06-14T12:00:00Z"))).toBe(45))
  test("on birthday", () =>
    expect(c.ageInYears("1980-06-15", new Date("2026-06-15T12:00:00Z"))).toBe(46))
  test("future DOB is null", () =>
    expect(c.ageInYears("2030-01-01", new Date("2026-01-01"))).toBeNull())
  test("empty DOB is null", () => expect(c.ageInYears("")).toBeNull())
  test("exact age is fractional", () =>
    expect(c.ageInYearsExact("2026-01-01", new Date("2026-07-02T12:00:00Z"))).toBeCloseTo(0.5, 2))
})

function withHemo(h: Partial<Patient["hemodynamics"]>, body?: Partial<Patient["body"]>): Patient {
  const p = emptyPatient()
  p.hemodynamics = { ...p.hemodynamics, ...h }
  p.body = { ...p.body, ...body }
  return p
}

describe("hemodynamics", () => {
  test("derives mPAP, TPG, DPG and PVR", () => {
    const r = c.patientHemodynamics(
      withHemo({ paSystolic: 50, paDiastolic: 20, paMean: null, pcwp: 18, cardiacOutput: 4 })
    )
    expect(r.paMean).toBe(30)
    expect(r.paMeanDerived).toBe(true)
    expect(r.tpg).toBe(12)
    expect(r.dpg).toBe(2)
    expect(r.pvr).toBe(3)
  })

  test("measured mPAP wins and is not flagged as derived", () => {
    const r = c.patientHemodynamics(
      withHemo({ paSystolic: 50, paDiastolic: 20, paMean: 32, pcwp: 18, cardiacOutput: 4 })
    )
    expect(r.paMean).toBe(32)
    expect(r.paMeanDerived).toBe(false)
  })

  test("CI derived from CO / BSA when not measured", () => {
    const r = c.patientHemodynamics(
      withHemo({ paMean: 30, pcwp: 18, cardiacOutput: 4 }, { heightCm: 180, weightKg: 80 })
    )
    expect(r.cardiacIndex).toBeCloseTo(2.0, 3)
    expect(r.cardiacIndexDerived).toBe(true)
    expect(r.pvri).toBeCloseTo(6.0, 3)
  })

  test("missing PCWP leaves TPG and PVR null", () => {
    const r = c.patientHemodynamics(withHemo({ paMean: 30, cardiacOutput: 4 }))
    expect(r.tpg).toBeNull()
    expect(r.pvr).toBeNull()
  })

  test("effective PVR uses post-challenge value when a challenge was done", () => {
    const base = { paMean: 40, pcwp: 20, cardiacOutput: 4 }
    expect(c.effectivePvr(withHemo(base))).toBe(5)
    expect(
      c.effectivePvr(withHemo({ ...base, vasodilatorChallengeDone: true, pvrAfterChallenge: 2.1 }))
    ).toBe(2.1)
    expect(
      c.effectivePvr(withHemo({ ...base, vasodilatorChallengeDone: true, pvrAfterChallenge: null }))
    ).toBe(5)
  })
})

describe("ischemia estimate", () => {
  const pair = { ...defaultPairInputs(), procurementMinutes: 30, transportMinutes: 120, implantMinutes: 60 }

  test("adds redo sternotomy and device explant time", () => {
    const p = emptyPatient()
    p.history.priorSternotomies = 1
    p.support.device = "lvad_durable"
    const r = c.estimateIschemia(pair, p, logistics)!
    expect(r.totalMinutes).toBe(30 + 120 + 60 + logistics.redoSternotomyExtraMinutes + logistics.deviceExplantExtraMinutes)
    expect(r.coldMinutes).toBe(r.totalMinutes)
    expect(r.unknowns).toEqual([])
  })

  test("normothermic perfusion time is removed from cold time", () => {
    const p = emptyPatient()
    p.history.priorSternotomies = 0
    const r = c.estimateIschemia({ ...pair, preservation: "ocs_normothermic", perfusionMinutes: 200 }, p, logistics)!
    expect(r.totalMinutes).toBe(210)
    expect(r.coldMinutes).toBe(10)
  })

  test("perfusion minutes are ignored without normothermic preservation", () => {
    const p = emptyPatient()
    p.history.priorSternotomies = 0
    const r = c.estimateIschemia({ ...pair, perfusionMinutes: 200 }, p, logistics)!
    expect(r.coldMinutes).toBe(210)
  })

  test("any missing time component returns null", () => {
    expect(c.estimateIschemia({ ...pair, transportMinutes: null }, emptyPatient(), logistics)).toBeNull()
  })

  test("unknown prior sternotomies is reported, not assumed zero silently", () => {
    const r = c.estimateIschemia(pair, emptyPatient(), logistics)!
    expect(r.unknowns).toContain("Prior sternotomies not recorded")
  })
})

describe("formatting", () => {
  test("formatMinutes", () => {
    expect(c.formatMinutes(45)).toBe("45 min")
    expect(c.formatMinutes(245)).toBe("4 h 05 min")
  })
})
