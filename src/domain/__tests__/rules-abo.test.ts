import { describe, expect, it } from "vitest"
import { DEFAULT_CRITERIA } from "../criteria"
import { defaultPairInputs } from "../factories"
import type { Abo } from "../options"
import type { RuleContext } from "../rules/context"
import { aboCompatible, aboPriority, evaluateAbo } from "../rules/abo"
import { donor, patient } from "./builders"

const context = (): RuleContext => ({
  patient: patient({ blood: { abo: "B", verifiedTwoSamples: true } }),
  donor: donor({ blood: { abo: "A", verifiedTwoSamples: true } }),
  criteria: structuredClone(DEFAULT_CRITERIA),
  pair: defaultPairInputs(),
  now: new Date("2026-11-14T00:00:00Z"),
})
const child = () => {
  const ctx = context()
  ctx.patient.identity.dateOfBirth = "2021-11-14"
  ctx.patient.blood.acceptsIncompatible = true
  ctx.patient.blood.antiATiter = 8
  ctx.patient.blood.titerDate = "2026-11-04"
  return ctx
}

describe("ABO", () => {
  it.each<[Abo, Abo]>([
    ["A", "AB"],
    ["B", "AB"],
  ])("treats compatible %s to %s as primary", (d, r) =>
    expect(aboPriority(d, r)).toBe("primary")
  )
  it.each<[Abo, Array<boolean>]>([
    ["O", [true, true, true, true]],
    ["A", [false, true, false, true]],
    ["B", [false, false, true, true]],
    ["AB", [false, false, false, true]],
  ])("checks donor %s against all recipients", (d, expected) => {
    const recipients: Array<Abo> = ["O", "A", "B", "AB"]
    recipients.forEach((r, i) => expect(aboCompatible(d, r)).toBe(expected[i]))
  })
  it("reports primary, secondary and incompatible priority", () => {
    expect(aboPriority("O", "B")).toBe("primary")
    expect(aboPriority("O", "A")).toBe("secondary")
    expect(aboPriority("A", "B")).toBe("incompatible")
  })
  it("marks missing ABO as missing review", () => {
    const ctx = context()
    ctx.patient.blood.abo = null
    expect(evaluateAbo(ctx)).toMatchObject({
      status: "review",
      findings: expect.arrayContaining([
        expect.objectContaining({ missing: true }),
      ]),
    })
  })
  it("reviews unverified identical types", () => {
    const ctx = context()
    ctx.donor.blood.abo = "B"
    ctx.donor.blood.verifiedTwoSamples = false
    expect(evaluateAbo(ctx).status).toBe("review")
  })
  it("passes verified identical types", () => {
    const ctx = context()
    ctx.donor.blood.abo = "B"
    expect(evaluateAbo(ctx).status).toBe("pass")
  })
  it("fails adult incompatible types", () =>
    expect(evaluateAbo(context()).status).toBe("fail"))
  it("reviews opted in infants without titers", () => {
    const ctx = child()
    ctx.patient.identity.dateOfBirth = "2026-05-14"
    ctx.patient.blood.antiATiter = null
    expect(evaluateAbo(ctx).status).toBe("review")
    expect(evaluateAbo(ctx).findings.some((f) => f.missing)).toBe(false)
  })
  it("reviews an eligible five year old", () =>
    expect(evaluateAbo(child()).status).toBe("review"))
  it("fails high titers", () => {
    const ctx = child()
    ctx.patient.blood.antiATiter = 32
    expect(evaluateAbo(ctx).status).toBe("fail")
  })
  it.each(["2026-10-05", "", "2026-11-15"])(
    "marks stale, absent or future titer date %s missing",
    (date) => {
      const ctx = child()
      ctx.patient.blood.titerDate = date
      expect(evaluateAbo(ctx).findings.some((f) => f.missing)).toBe(true)
    }
  )
  it("fails recent titer lowering therapy", () => {
    const ctx = child()
    ctx.patient.blood.titerLoweringTherapyWithin30Days = true
    expect(evaluateAbo(ctx).status).toBe("fail")
  })
  it("fails when pediatric pathway disabled", () => {
    const ctx = child()
    ctx.criteria.abo.allowPediatricIncompatible = false
    expect(evaluateAbo(ctx).status).toBe("fail")
  })
  it("uses pediatric age at listing even when currently adult", () => {
    const ctx = child()
    ctx.patient.identity.dateOfBirth = "2007-01-01"
    ctx.patient.listing.listingDate = "2024-01-01"
    expect(evaluateAbo(ctx).status).toBe("review")
  })
  it("requires both titers for an O recipient", () => {
    const ctx = child()
    ctx.patient.blood.abo = "O"
    expect(evaluateAbo(ctx).findings.some((f) => f.missing)).toBe(true)
  })
  it("passes compatible nonidentical types with priority info and subtype info", () => {
    const ctx = context()
    ctx.donor.blood.abo = "O"
    ctx.patient.blood.subtype = "A2"
    const result = evaluateAbo(ctx)
    expect(result.status).toBe("pass")
    expect(
      result.findings.filter((f) => f.status === "info").length
    ).toBeGreaterThanOrEqual(2)
  })
})
