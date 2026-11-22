import { expect, test } from "vitest"
import { DEFAULT_CRITERIA } from "../criteria"
import { defaultPairInputs } from "../factories"
import { DONOR_TEST_VALUES } from "../options"
import type { RuleContext } from "../rules/context"
import { evaluateInfection } from "../rules/infection"
import { donor, patient } from "./builders"

function context(): RuleContext {
  const ctx = {
    donor: donor(),
    patient: patient(),
    pair: defaultPairInputs(),
    criteria: structuredClone(DEFAULT_CRITERIA),
    now: new Date(),
  }
  for (const key of DONOR_TEST_VALUES)
    ctx.donor.infection.serology[key] = "negative"
  for (const key of ["cmvIgG", "ebvIgG", "toxoIgG"] as const)
    ctx.patient.serology[key] = "negative"
  Object.assign(ctx.patient.acceptance, {
    acceptHcvNat: true,
    acceptHcvAb: true,
    acceptHbvNat: true,
    acceptAntiHbc: true,
    acceptPhsRisk: true,
  })
  ctx.donor.infection.sampleDrawnWithin96h = true
  ctx.donor.infection.bloodCulturePositive = "no"
  ctx.donor.infection.cnsInfection = "none"
  ctx.donor.history.bornInChagasEndemicCountry = "no"
  return ctx
}
test("complete negative panel passes", () =>
  expect(evaluateInfection(context()).status).toBe("pass"))
test("required HBV NAT missing has stable missing finding", () => {
  const c = context()
  c.donor.infection.serology.hbvNat = "not_done"
  expect(evaluateInfection(c).findings).toContainEqual(
    expect.objectContaining({
      code: "infection.missing.hbvNat",
      missing: true,
      status: "review",
    })
  )
})
test.each(["hivNat", "hivAbAg", "chagas", "wnv"] as const)(
  "%s positive fails",
  (key) => {
    const c = context()
    c.donor.infection.serology[key] = "positive"
    expect(evaluateInfection(c).status).toBe("fail")
  }
)
test.each([
  "hcvNat",
  "antiHcv",
  "hbsAg",
  "hbvNat",
  "antiHbc",
  "cmvIgG",
  "ebvIgG",
  "toxoIgG",
  "strongyloides",
  "syphilis",
] as const)("%s positive reviews", (key) => {
  const c = context()
  c.donor.infection.serology[key] = "positive"
  expect(evaluateInfection(c).status).toBe("review")
})
test.each([
  ["hcvNat", "acceptHcvNat"],
  ["antiHcv", "acceptHcvAb"],
  ["hbvNat", "acceptHbvNat"],
  ["antiHbc", "acceptAntiHbc"],
] as const)("%s optout fails", (key, opt) => {
  const c = context()
  c.donor.infection.serology[key] = "positive"
  c.patient.acceptance[opt] = false
  expect(evaluateInfection(c).status).toBe("fail")
})
test("HIV HOPE exception reviews", () => {
  const c = context()
  c.donor.infection.serology.hivNat = "positive"
  c.patient.serology.hiv = "positive"
  c.patient.enrolledHivResearchProtocol = true
  expect(evaluateInfection(c).status).toBe("review")
})
test("CMV immune recipient is informational", () => {
  const c = context()
  c.donor.infection.serology.cmvIgG = "positive"
  c.patient.serology.cmvIgG = "positive"
  expect(evaluateInfection(c).status).toBe("pass")
})
test("conditional Chagas missing reviews", () => {
  const c = context()
  c.donor.history.bornInChagasEndemicCountry = "yes"
  c.donor.infection.serology.chagas = "not_done"
  expect(evaluateInfection(c).findings.some((f) => f.missing)).toBe(true)
})
test("old sample reviews", () => {
  const c = context()
  c.donor.infection.sampleDrawnWithin96h = false
  expect(evaluateInfection(c).status).toBe("review")
})
test("indeterminate donor test reviews", () => {
  const c = context()
  c.donor.infection.serology.hbsAg = "indeterminate"
  expect(evaluateInfection(c).status).toBe("review")
})
test.each([
  "viral_fungal_amebic",
  "bacterial_untreated",
  "bacterial_treated",
] as const)("CNS %s", (value) => {
  const c = context()
  c.donor.infection.cnsInfection = value
  expect(evaluateInfection(c).status).toBe(
    value === "viral_fungal_amebic"
      ? "fail"
      : value === "bacterial_untreated"
        ? "review"
        : "pass"
  )
})
test.each([true, false])("PHS acceptance %s", (accept) => {
  const c = context()
  c.donor.history.phsRiskCriteria = ["idu"]
  c.patient.acceptance.acceptPhsRisk = accept
  expect(evaluateInfection(c).status).toBe(accept ? "review" : "fail")
})
test("unknown culture and CNS create missing findings", () => {
  const c = context()
  c.donor.infection.bloodCulturePositive = "unknown"
  c.donor.infection.cnsInfection = "unknown"
  expect(evaluateInfection(c).findings.filter((f) => f.missing)).toHaveLength(2)
})
test("recipient missing serology reviews", () => {
  const c = context()
  c.patient.serology.ebvIgG = "not_done"
  expect(evaluateInfection(c).findings.some((f) => f.missing)).toBe(true)
})
test("configured positive outcome is honored", () => {
  const c = context()
  c.donor.infection.serology.syphilis = "positive"
  c.criteria.infection.syphilisOutcome = "fail"
  expect(evaluateInfection(c).status).toBe("fail")
})

test("HIV positive donor with missing recipient HIV also flags missing information", () => {
  const c = context()
  c.donor.infection.serology.hivNat = "positive"
  c.patient.serology.hiv = "not_done"
  expect(evaluateInfection(c).findings).toContainEqual(
    expect.objectContaining({
      code: "infection.missing.recipient.hiv",
      missing: true,
    })
  )
})
test("WNV not done is missing when referral falls 1 July to 31 October (OPTN 2.10.6)", () => {
  for (const [date, flagged] of [
    ["2026-07-01", true],
    ["2026-10-31", true],
    ["2026-06-30", false],
    ["2026-11-01", false],
    ["", false],
  ] as const) {
    const c = context()
    c.donor.infection.serology.wnv = "not_done"
    c.donor.identity.referralDate = date
    const codes = evaluateInfection(c).findings.map((f) => f.code)
    expect(codes.includes("infection.missing.wnv")).toBe(flagged)
  }
})
test("WNV negative in season adds no finding", () => {
  const c = context()
  c.donor.identity.referralDate = "2026-08-15"
  expect(evaluateInfection(c).status).toBe("pass")
})
