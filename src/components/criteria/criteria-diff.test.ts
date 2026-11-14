import { describe, expect, it } from "vitest"
import { DEFAULT_CRITERIA } from "@/domain/criteria"
import { criteriaChanges } from "./criteria-diff"

describe("criteria field diff", () => {
  it("compares all descriptors without mutating frozen snapshots", () => {
    const before = structuredClone(DEFAULT_CRITERIA)
    Object.freeze(before.donor)
    Object.freeze(before)
    const after = structuredClone(before)
    after.donor.ageFailAbove = 65
    after.abo.allowPediatricIncompatible = false
    after.infection.hcvNatOutcome = "fail"
    const changes = criteriaChanges(before, after)
    expect(changes.map((change) => change.field.key)).toEqual([
      "allowPediatricIncompatible",
      "hcvNatOutcome",
      "ageFailAbove",
    ])
    expect(changes[2]).toMatchObject({ oldValue: null, newValue: 65 })
    expect(before.donor.ageFailAbove).toBeNull()
    expect(criteriaChanges(before, structuredClone(before))).toEqual([])
  })
})
