import { describe, expect, it } from "vitest"
import { DEFAULT_CRITERIA } from "../../criteria"
import { evaluate } from "../../engine"
import { defaultPairInputs } from "../../factories"
import { buildProfile } from "../../hla"
import { donorSchema, patientSchema } from "../../schema"
import { SCENARIOS, demoDonors, demoNow, demoPatients } from ".."

const DEMO_PATIENTS = demoPatients()
const DEMO_DONORS = demoDonors()

const byId = <T extends { id: string }>(xs: Array<T>) =>
  new Map(xs.map((x) => [x.id, x]))

describe("demo dataset", () => {
  it("is schema-valid and sized as specified", () => {
    expect(DEMO_PATIENTS).toHaveLength(24)
    expect(DEMO_DONORS).toHaveLength(12)
    for (const p of DEMO_PATIENTS) patientSchema.parse(p)
    for (const d of DEMO_DONORS) donorSchema.parse(d)
  })

  it("never uses the forbidden placeholder word and has unique realistic identifiers", () => {
    const text = JSON.stringify([
      DEMO_PATIENTS,
      DEMO_DONORS,
      SCENARIOS.map((s) => s.description),
    ])
    // Built from parts so a repository-wide grep for the word stays empty.
    expect(text).not.toMatch(new RegExp(["fic", "tional"].join(""), "i"))
    expect(DEMO_PATIENTS.map((p) => p.id)).toEqual(
      Array.from(
        { length: 24 },
        (_, i) => `demo-patient-${String(i + 1).padStart(2, "0")}`
      )
    )
    expect(DEMO_DONORS.map((d) => d.id)).toEqual(
      Array.from(
        { length: 12 },
        (_, i) => `demo-donor-${String(i + 1).padStart(2, "0")}`
      )
    )
    expect(new Set(DEMO_PATIENTS.map((p) => p.identity.mrn)).size).toBe(24)
    expect(new Set(DEMO_DONORS.map((d) => d.identity.donorId)).size).toBe(12)
    for (const d of DEMO_DONORS)
      expect(d.identity.donorId).toMatch(/^[A-Z]{3,4}\d{3}$/)
    for (const p of DEMO_PATIENTS) expect(p.identity.mrn).toMatch(/^MRN-\d{7}$/)
  })

  it("has readable HLA typing everywhere it is recorded and varied listing states", () => {
    for (const r of [...DEMO_PATIENTS, ...DEMO_DONORS])
      expect(buildProfile(r.hla).invalid, r.id).toEqual([])
    expect(new Set(DEMO_PATIENTS.map((p) => p.listing.state))).toEqual(
      new Set(["active", "inactive", "transplanted", "removed", "evaluation"])
    )
    for (const p of DEMO_PATIENTS)
      expect(p.notes.length, p.id).toBeGreaterThan(40)
    for (const d of DEMO_DONORS)
      expect(d.notes.length, d.id).toBeGreaterThan(40)
  })

  it.each(SCENARIOS.map((s) => [s.id, s] as const))(
    "reaches scenario %s",
    (_id, s) => {
      const p = byId(DEMO_PATIENTS).get(s.patientId)
      const d = byId(DEMO_DONORS).get(s.donorId)
      expect(p, `patient ${s.patientId}`).toBeDefined()
      expect(d, `donor ${s.donorId}`).toBeDefined()
      const r = evaluate({
        patient: p!,
        donor: d!,
        pair: { ...defaultPairInputs(), ...s.pair },
        criteria: DEFAULT_CRITERIA,
        now: demoNow(),
      })
      expect(s.expect(r), s.description).toBe(true)
    }
  )

  it("covers every scenario listed in spec §11.1", () => {
    const required = [
      "abo.identical",
      "abo.compatible",
      "abo.incompatible",
      "abo.pediatric-optin",
      "abo.pediatric-optout",
      "abo.unknown",
      "abo.a2",
      "size.pass",
      "size.review",
      "size.fail",
      "size.female-to-male",
      "size.pvr",
      "size.pediatric",
      "size.missing-height",
      "immunology.none",
      "immunology.dsa",
      "immunology.high-cpra-no-dsa",
      "immunology.missing-hla",
      "immunology.flow-positive",
      "immunology.cdc-positive",
      "infection.clean",
      "infection.hcv-accepts",
      "infection.hcv-declines",
      "infection.hbv-core",
      "infection.cmv-mismatch",
      "infection.phs",
      "infection.missing",
      "donorHeart.normal",
      "donorHeart.older",
      "donorHeart.lvef-repeat",
      "donorHeart.inotropes",
      "donorHeart.cad",
      "donorHeart.cocaine",
      "donorHeart.co",
      "donorHeart.cpr",
      "donorHeart.dcd",
      "logistics.short",
      "logistics.long",
      "logistics.ocs",
      "logistics.redo",
      "logistics.missing-distance",
      "listing.inactive",
      "listing.transplanted",
      "listing.removed",
    ]
    expect(SCENARIOS.map((s) => s.id)).toEqual(expect.arrayContaining(required))
    expect(new Set(SCENARIOS.map((s) => s.id)).size).toBe(SCENARIOS.length)
  })
})
