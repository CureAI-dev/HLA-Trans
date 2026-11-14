import { describe, expect, it } from "vitest"
import { DEFAULT_CRITERIA } from "../criteria"
import { patientPhm, predictedHeartMass } from "../calc"
import { defaultPairInputs } from "../factories"
import type { RuleContext } from "../rules/context"
import { evaluateSize } from "../rules/size"
import { donor, patient } from "./builders"

function context(): RuleContext {
  return {
    patient: patient({
      identity: { sex: "male" },
      body: { heightCm: 175, weightKg: 80 },
      hemodynamics: {
        paMean: 25,
        pcwp: 15,
        cardiacOutput: 5,
        vasodilatorChallengeDone: false,
      },
    }),
    donor: donor({
      identity: { sex: "male" },
      body: { heightCm: 175, weightKg: 80 },
    }),
    criteria: structuredClone(DEFAULT_CRITERIA),
    pair: defaultPairInputs(),
    now: new Date("2026-11-14T00:00:00Z"),
  }
}
function phmRatio(ratio: number) {
  const ctx = context()
  const target = patientPhm(ctx.patient, ctx.now)!.total * ratio
  let low = 1,
    high = 350
  for (let i = 0; i < 60; i++) {
    const weight = (low + high) / 2
    const total = predictedHeartMass({
      sex: "male",
      ageYears: 35,
      heightCm: 175,
      weightKg: weight,
    })!.total
    if (total < target) low = weight
    else high = weight
  }
  ctx.donor.body.weightKg = (low + high) / 2
  return ctx
}
function weightRatio(ratio: number) {
  const ctx = context()
  ctx.donor.body.heightCm = null
  ctx.donor.body.weightKg = ratio * 80
  return ctx
}
describe("size rule", () => {
  it.each([
    [1, "pass"],
    [0.8, "review"],
    [0.65, "fail"],
    [1.4, "review"],
  ] as const)("PHM ratio %s is %s", (ratio, status) => {
    expect(evaluateSize(phmRatio(ratio)).status).toBe(status)
  })
  it("shows weight ratio and sex flag as info when PHM is used", () => {
    const result = evaluateSize(phmRatio(1))
    expect(
      result.findings.some(
        (f) => f.status === "info" && f.evidence.includes("Weight ratio")
      )
    ).toBe(true)
    expect(
      result.findings.some((f) => f.status === "info" && f.code === "size.sex")
    ).toBe(true)
    expect(
      result.findings.find((f) => f.code === "size.phm")?.evidence
    ).toMatch(/PHM ratio 1.00 \(donor \d+\.\d{2} g \/ recipient \d+\.\d{2} g\)/)
  })
  it("tightens PHM size for derived PVR 5 and uses post-challenge PVR 3", () => {
    const ctx = phmRatio(0.92)
    ctx.patient.hemodynamics.paMean = 40
    expect(evaluateSize(ctx).status).toBe("review")
    ctx.patient.hemodynamics.vasodilatorChallengeDone = true
    ctx.patient.hemodynamics.pvrAfterChallenge = 3
    expect(evaluateSize(ctx).status).toBe("pass")
  })
  it.each([
    [0.85, "pass"],
    [0.75, "review"],
    [0.6, "fail"],
  ] as const)("weight fallback %s is %s", (ratio, status) =>
    expect(evaluateSize(weightRatio(ratio)).status).toBe(status)
  )
  it("reviews female-to-male fallback below its editable minimum", () => {
    const ctx = weightRatio(0.78)
    ctx.donor.identity.sex = "female"
    ctx.criteria.size.weightRatioPassMin = 0.75
    expect(evaluateSize(ctx).status).toBe("review")
  })
  it("reviews all missing size data", () => {
    const ctx = context()
    ctx.patient.body = { heightCm: null, weightKg: null }
    ctx.donor.body = { heightCm: null, weightKg: null }
    expect(
      evaluateSize(ctx).findings.some((f) => f.missing && f.status === "review")
    ).toBe(true)
  })
  it.each([false, true])("reviews missing PVR (challenge %s)", (challenge) => {
    const ctx = phmRatio(0.92)
    ctx.patient.hemodynamics.vasodilatorChallengeDone = challenge
    ctx.patient.hemodynamics.pvrAfterChallenge = null
    ctx.patient.hemodynamics.cardiacOutput = null
    expect(evaluateSize(ctx).status).toBe("review")
    expect(
      evaluateSize(ctx).findings.some(
        (f) => f.code === "size.pvr.missing" && f.missing
      )
    ).toBe(true)
  })
  it.each([
    [2.5, "pass"],
    [3.5, "fail"],
    [0.6, "pass"],
    [3, "pass"],
  ] as const)("pediatric weight %s is %s", (ratio, status) => {
    const ctx = weightRatio(ratio)
    ctx.patient.identity.dateOfBirth = "2018-11-14"
    expect(evaluateSize(ctx).status).toBe(status)
  })
  it("fails weight outside recipient minimum or maximum", () => {
    const ctx = weightRatio(0.75)
    ctx.patient.acceptance.minDonorWeightKg = 65
    expect(evaluateSize(ctx).status).toBe("fail")
    ctx.patient.acceptance.minDonorWeightKg = null
    ctx.patient.acceptance.maxDonorWeightKg = 59
    expect(evaluateSize(ctx).status).toBe("fail")
  })
  it("reviews missing recipient age", () => {
    const ctx = context()
    ctx.patient.identity.dateOfBirth = ""
    expect(evaluateSize(ctx).status).toBe("review")
  })
  it("uses edited PHM criteria", () => {
    const ctx = phmRatio(0.92)
    ctx.criteria.size.phmRatioPassMin = 0.95
    expect(evaluateSize(ctx).status).toBe("review")
  })
})
