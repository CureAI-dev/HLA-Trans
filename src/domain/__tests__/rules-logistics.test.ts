import { expect, test } from "vitest"
import { DEFAULT_CRITERIA } from "../criteria"
import { defaultPairInputs } from "../factories"
import type { RuleContext } from "../rules/context"
import { evaluateLogistics } from "../rules/logistics"
import { donor, patient } from "./builders"

function context(total: number | null = 210): RuleContext {
  return {
    donor: donor(),
    patient: patient({ history: { priorSternotomies: 0 } }),
    criteria: structuredClone(DEFAULT_CRITERIA),
    pair: {
      ...defaultPairInputs(),
      procurementMinutes: 30,
      transportMinutes: total === null ? null : total - 60,
      implantMinutes: 30,
    },
    now: new Date("2026-11-14T00:00:00Z"),
  }
}

test.each([
  [210, "pass"],
  [240, "pass"],
  [241, "review"],
  [300, "review"],
  [360, "review"],
  [400, "fail"],
  [null, "review"],
] as const)("total %s yields %s", (minutes, status) => {
  const result = evaluateLogistics(context(minutes))
  expect(result.status).toBe(status)
  expect(result.findings.some((f) => f.missing)).toBe(minutes === null)
})

test("OCS subtracts perfusion and reports machine use", () => {
  const ctx = context(400)
  Object.assign(ctx.pair, {
    preservation: "ocs_normothermic",
    perfusionMinutes: 200,
  })
  const result = evaluateLogistics(ctx)
  expect(result.status).toBe("pass")
  expect(result.findings).toContainEqual(
    expect.objectContaining({ code: "logistics.perfusion", status: "info" })
  )
})

test("older donor uses total time even with reduced cold time", () => {
  const ctx = context(250)
  ctx.donor.identity.ageYears = 50
  Object.assign(ctx.pair, {
    preservation: "ocs_normothermic",
    perfusionMinutes: 100,
  })
  expect(evaluateLogistics(ctx).status).toBe("review")
})

test.each([
  "procurementMinutes",
  "transportMinutes",
  "implantMinutes",
] as const)("missing %s cannot pass", (key) => {
  const ctx = context()
  ctx.pair[key] = null
  expect(evaluateLogistics(ctx).findings).toContainEqual(
    expect.objectContaining({ missing: true, status: "review" })
  )
})

test.each([25, 30, 40, 45, 50, null])("DCD warm time %s", (minutes) => {
  const ctx = context()
  Object.assign(ctx.donor.donation, {
    type: "dcd",
    dcdRecovery: "dpp",
    functionalWarmIschemiaMinutes: minutes,
  })
  ctx.patient.acceptance.acceptDcd = true
  expect(evaluateLogistics(ctx).status).toBe(
    minutes === null || (minutes > 30 && minutes <= 45)
      ? "review"
      : minutes > 45
        ? "fail"
        : "pass"
  )
})

test("DCD opt-out fails and missing recovery reviews independently", () => {
  const ctx = context()
  ctx.donor.donation.type = "dcd"
  ctx.patient.acceptance.acceptDcd = false
  const result = evaluateLogistics(ctx)
  expect(result.status).toBe("fail")
  expect(result.findings).toContainEqual(
    expect.objectContaining({ code: "logistics.dcdRecovery", missing: true })
  )
})

test("distance limit requires recorded distance and fails above maximum", () => {
  const ctx = context()
  ctx.patient.acceptance.maxDistanceNm = 500
  expect(evaluateLogistics(ctx).status).toBe("review")
  ctx.pair.distanceNm = 500
  expect(evaluateLogistics(ctx).status).toBe("pass")
  ctx.pair.distanceNm = 600
  expect(evaluateLogistics(ctx).status).toBe("fail")
})

test("unknown age, prior sternotomies and OCS perfusion cannot silently pass", () => {
  const ctx = context(210)
  ctx.donor.identity.ageYears = null
  ctx.patient.history.priorSternotomies = null
  Object.assign(ctx.pair, {
    preservation: "ocs_normothermic",
    perfusionMinutes: null,
  })
  const result = evaluateLogistics(ctx)
  expect(result.status).toBe("review")
  expect(
    result.findings.filter((f) => f.missing).length
  ).toBeGreaterThanOrEqual(3)
})

test("redo and explant additions and configurable limits affect outcome", () => {
  const ctx = context(210)
  ctx.patient.history.priorSternotomies = 1
  ctx.patient.support.device = "lvad_durable"
  expect(evaluateLogistics(ctx).status).toBe("review")
  ctx.criteria.logistics.ischemicReviewMaxMinutes = 300
  expect(evaluateLogistics(ctx).status).toBe("fail")
})

test.each([
  [44, false],
  [45, true],
])("older donor (%i y) with total over 240 min flagged: %s", (age, flagged) => {
  const c = context(250)
  c.donor.identity.ageYears = age
  const codes = evaluateLogistics(c).findings.map((f) => f.code)
  expect(codes.includes("logistics.olderDonor")).toBe(flagged)
})
