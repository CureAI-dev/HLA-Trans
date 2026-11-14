import { describe, expect, test } from "vitest"
import { DEFAULT_CRITERIA } from "../criteria"
import {
  defaultPairInputs,
  emptyDonor,
  emptyHlaTyping,
  emptyPatient,
} from "../factories"
import { evaluateImmunology } from "../rules/immunology"

function context() {
  const patient = emptyPatient()
  patient.sensitization.cpra = 0
  const donor = emptyDonor()
  donor.hla.A = ["A*02:01", "A*24:02"]
  donor.hla.B = ["B15", "B44"]
  return {
    patient,
    donor,
    pair: defaultPairInputs(),
    criteria: structuredClone(DEFAULT_CRITERIA),
    now: new Date("2026-11-14T00:00:00Z"),
  }
}
function antibody(
  antigen: string,
  mfi: number,
  c1q: "positive" | "negative" = "negative"
) {
  return { id: "ab-1", antigen, mfi, c1q, testDate: "2026-11-14" }
}

describe("immunology", () => {
  test.each([
    ["A9", "fail"],
    ["B62", "review"],
  ] as const)("unacceptable %s", (antigen, status) => {
    const ctx = context()
    ctx.patient.sensitization.unacceptableAntigens = [antigen]
    expect(evaluateImmunology(ctx).status).toBe(status)
  })
  test.each([
    ["B44", 6000, "negative", "fail"],
    ["B44", 3000, "negative", "review"],
    ["B44", 3000, "positive", "fail"],
    ["B44", 1500, "negative", "pass"],
    ["A23", 9000, "negative", "pass"],
    ["B62", 9000, "positive", "review"],
    ["B44", 2000, "negative", "review"],
    ["B44", 5000, "negative", "fail"],
  ] as const)("antibody %s %i %s", (antigen, mfi, c1q, status) => {
    const ctx = context()
    ctx.patient.sensitization.antibodies = [antibody(antigen, mfi, c1q)]
    expect(evaluateImmunology(ctx).status).toBe(status)
    if (mfi === 1500)
      expect(evaluateImmunology(ctx).findings).toContainEqual(
        expect.objectContaining({
          status: "info",
          title: "1 antibody below review level",
        })
      )
  })
  test.each([null, 40, 0])("no specificities and cPRA %s", (cpra) => {
    const ctx = context()
    ctx.patient.sensitization.cpra = cpra
    const result = evaluateImmunology(ctx)
    expect(result.status).toBe(cpra === 0 ? "pass" : "review")
    if (cpra !== 0) expect(result.findings.some((f) => f.missing)).toBe(true)
  })
  test("untyped donor and untyped target locus are missing", () => {
    const ctx = context()
    ctx.patient.sensitization.antibodies = [antibody("B44", 6000)]
    ctx.donor.hla = emptyHlaTyping()
    expect(evaluateImmunology(ctx).findings).toContainEqual(
      expect.objectContaining({ status: "review", missing: true })
    )
    ctx.donor.hla.A = ["A2", "A24"]
    expect(evaluateImmunology(ctx).findings).toContainEqual(
      expect.objectContaining({ status: "review", missing: true })
    )
  })
  test.each([
    ["cdcCrossmatch", "fail"],
    ["flowCrossmatch", "review"],
  ] as const)("positive %s", (key, status) => {
    const ctx = context()
    ctx.pair[key] = "positive"
    expect(evaluateImmunology(ctx).status).toBe(status)
    ctx.criteria.immunology[
      key === "cdcCrossmatch"
        ? "cdcCrossmatchPositiveOutcome"
        : "flowCrossmatchPositiveOutcome"
    ] = "pass"
    expect(evaluateImmunology(ctx).status).toBe("pass")
  })
  test("invalid entries review; null alleles and mismatches inform", () => {
    const ctx = context()
    ctx.donor.hla.A = ["Q12", "A2"]
    expect(evaluateImmunology(ctx).status).toBe("review")
    ctx.donor.hla.A = ["A*24:09N", "A2"]
    ctx.donor.hla.DRB1 = ["DR15", ""]
    ctx.patient.hla = structuredClone(ctx.donor.hla)
    expect(
      evaluateImmunology(ctx).findings.filter((f) => f.status === "info").length
    ).toBeGreaterThanOrEqual(2)
  })
  test("criteria configure thresholds and outcomes; one hit per target; ordered severity", () => {
    const ctx = context()
    ctx.patient.sensitization.antibodies = [
      antibody("B44", 3000, "positive"),
      antibody("B62", 6000),
      antibody("A2", 1000),
    ]
    ctx.patient.sensitization.unacceptableAntigens = ["A9"]
    let result = evaluateImmunology(ctx)
    expect(
      result.findings.filter((f) => f.code.startsWith("immunology.dsa.")).length
    ).toBe(2)
    const ranks = result.findings.map(
      (f) => ({ fail: 0, review: 1, pass: 2, info: 3 })[f.status]
    )
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
    ctx.criteria.immunology.unacceptableAntigenOutcome = "pass"
    ctx.criteria.immunology.c1qPositiveOutcome = "pass"
    ctx.criteria.immunology.mfiReviewMin = 7000
    ctx.criteria.immunology.mfiFailMin = 8000
    result = evaluateImmunology(ctx)
    expect(result.status).toBe("pass")
  })
})
