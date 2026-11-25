import { describe, expect, it } from "vitest"
import { DEFAULT_CRITERIA } from "@/domain/criteria"
import { evaluate } from "@/domain/engine"
import { defaultPairInputs } from "@/domain/factories"
import { patientRiskFlags } from "@/domain/risk-flags"
import type { PairInputs } from "@/domain/schema"
import {
  PRACTICE_VALUES,
  explainResult,
  practiceMatch,
  practicePair,
  practicePatientRows,
  practiceRun,
  practiceScreening,
} from "../practice"

const outcome = (patch: Partial<PairInputs>) =>
  evaluate({
    ...practicePair(),
    pair: { ...defaultPairInputs(), ...patch },
    criteria: DEFAULT_CRITERIA,
  })

// The tutorials describe these results in words. If a rule change breaks one, the text must change too.
describe("practice pair", () => {
  it("is REVIEW with blank inputs, for four missing values only", () => {
    const r = outcome({})
    expect(r.overall).toBe("review")
    expect(r.blockers).toEqual([])
    expect(
      r.rules.filter((x) => x.status !== "pass").map((x) => x.rule)
    ).toEqual(["logistics"])
    expect(
      r.rules.flatMap((x) => x.findings).filter((f) => f.missing)
    ).toHaveLength(4)
  })
  it("is PASS with the suggested values", () => {
    expect(outcome(PRACTICE_VALUES).overall).toBe("pass")
  })
  it("is REVIEW at 250 minutes and FAIL at 400 minutes or too far", () => {
    const v = PRACTICE_VALUES
    expect(outcome({ ...v, transportMinutes: 150 }).overall).toBe("review")
    expect(outcome({ ...v, transportMinutes: 300 }).overall).toBe("fail")
    expect(outcome({ ...v, distanceNm: 800 }).overall).toBe("fail")
  })
  it("explains each result with the numbers typed", () => {
    expect(
      explainResult({ minutes: 190, distanceNm: 180, overall: "pass" }).text
    ).toMatch(/190 minutes.*240 minutes is a PASS/)
    expect(
      explainResult({ minutes: 400, distanceNm: 180, overall: "fail" }).text
    ).toMatch(/400 minutes.*360 minutes is a FAIL/)
    expect(
      explainResult({ minutes: 190, distanceNm: 800, overall: "fail" }).text
    ).toMatch(/800 NM.*750 NM/)
    expect(
      explainResult({ minutes: 250, distanceNm: 180, overall: "review" }).text
    ).toMatch(/241 to 360/)
  })
  it("has what the other tutorials point at", () => {
    const { patient } = practicePair()
    expect(
      patientRiskFlags(patient, new Date(), DEFAULT_CRITERIA).some((f) =>
        f.title.includes("ECMO")
      )
    ).toBe(true)
    expect(practiceMatch("checked").result.overall).toBe("review")
    const rows = practiceScreening()
    expect(rows.length).toBeGreaterThan(3)
    expect(rows.every((r) => r.overall !== "pass")).toBe(true)
    expect(practicePatientRows().length).toBeGreaterThan(3)
    const run = practiceRun("donor")
    expect(run.passCount + run.reviewCount + run.failCount).toBe(run.total)
  })
})
