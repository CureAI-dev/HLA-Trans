import { describe, expect, test } from "vitest"
import { dbSchema, donorSchema, pairInputsSchema, patientSchema } from "../schema"
import { defaultPairInputs, emptyDonor, emptyPatient, newId } from "../factories"

describe("schemas", () => {
  test("empty patient fails only on required identity fields", () => {
    const r = patientSchema.safeParse(emptyPatient())
    expect(r.success).toBe(false)
    const paths = r.error!.issues.map((i) => i.path.join("."))
    expect(paths.sort()).toEqual(
      [
        "identity.dateOfBirth",
        "identity.firstName",
        "identity.lastName",
        "identity.mrn",
      ].sort()
    )
  })

  test("filled patient passes", () => {
    const p = emptyPatient()
    p.identity = {
      ...p.identity,
      mrn: "M1",
      firstName: "A",
      lastName: "B",
      dateOfBirth: "1970-01-01",
    }
    expect(patientSchema.safeParse(p).success).toBe(true)
  })

  test("donor requires donorId", () => {
    const d = emptyDonor()
    expect(donorSchema.safeParse(d).success).toBe(false)
    d.identity.donorId = "D-1"
    expect(donorSchema.safeParse(d).success).toBe(true)
  })

  test("null numbers are allowed, NaN and Infinity are not", () => {
    const d = emptyDonor()
    d.identity.donorId = "D-1"
    d.echo.lvef = null
    expect(donorSchema.safeParse(d).success).toBe(true)
    d.echo.lvef = Number.NaN
    expect(donorSchema.safeParse(d).success).toBe(false)
    d.echo.lvef = Number.POSITIVE_INFINITY
    expect(donorSchema.safeParse(d).success).toBe(false)
  })

  test("out-of-range values are rejected", () => {
    const d = emptyDonor()
    d.identity.donorId = "D-1"
    d.echo.lvef = 120
    expect(donorSchema.safeParse(d).success).toBe(false)
  })

  test("bad date format is rejected", () => {
    const p = emptyPatient()
    p.identity = {
      ...p.identity,
      mrn: "M1",
      firstName: "A",
      lastName: "B",
      dateOfBirth: "01/01/1970",
    }
    expect(patientSchema.safeParse(p).success).toBe(false)
  })

  test.each(["2026-02-31", "2026-99-99", "2025-02-29", "1900-02-29", "2026-04-31"])(
    "rejects impossible optional calendar date %s",
    (referralDate) => {
      const donor = emptyDonor()
      donor.identity.donorId = "D-1"
      donor.identity.referralDate = referralDate
      const result = donorSchema.safeParse(donor)
      expect(result.success).toBe(false)
      expect(result.error?.issues.map((issue) => issue.path.join("."))).toContain("identity.referralDate")
    }
  )

  test.each(["", "2024-02-29", "2000-02-29", "0099-01-01", "0000-02-29"])(
    "accepts optional calendar date %s",
    (referralDate) => {
      const donor = emptyDonor()
      donor.identity.donorId = "D-1"
      donor.identity.referralDate = referralDate
      expect(donorSchema.safeParse(donor).success).toBe(true)
    }
  )

  test("db requires at least one criteria version", () => {
    const r = dbSchema.safeParse({
      schemaVersion: 1,
      clinicianName: "",
      patients: [],
      donors: [],
      evaluations: [],
      criteriaVersions: [],
      audit: [],
    })
    expect(r.success).toBe(false)
  })
})

describe("factories", () => {
  test("empty records start with safe defaults (unknown, not done, null)", () => {
    const p = emptyPatient()
    expect(p.listing.state).toBe("evaluation")
    expect(p.blood.abo).toBeNull()
    expect(p.body.heightCm).toBeNull()
    expect(p.history.frailty).toBe("unknown")
    expect(Object.values(p.serology).every((v) => v === "not_done")).toBe(true)
    expect(p.acceptance.acceptDcd).toBe(true)
    expect(p.acceptance.acceptHcvNat).toBe(false)

    const d = emptyDonor()
    expect(d.identity.state).toBe("available")
    expect(d.death.cardiacArrest).toBe("unknown")
    expect(d.history.malignancyRisk).toBe("unknown")
    expect(Object.values(d.infection.serology).every((v) => v === "not_done")).toBe(true)
  })

  test("factories return fresh objects", () => {
    const a = emptyPatient()
    const b = emptyPatient()
    a.sensitization.antibodies.push({
      id: "ab_1",
      antigen: "A2",
      mfi: 1000,
      c1q: "not_done",
      testDate: "",
    })
    expect(b.sensitization.antibodies).toHaveLength(0)
    expect(a.id).not.toBe(b.id)
  })

  test("default pair inputs are valid and unrecorded", () => {
    const pair = defaultPairInputs()
    expect(pairInputsSchema.safeParse(pair).success).toBe(true)
    expect(pair.transportMinutes).toBeNull()
    expect(pair.preservation).toBe("static_cold")
    expect(pair.cdcCrossmatch).toBe("not_done")
  })

  test("newId uses the prefix", () => {
    expect(newId("pat")).toMatch(/^pat_[0-9a-f-]{36}$/)
  })
})
