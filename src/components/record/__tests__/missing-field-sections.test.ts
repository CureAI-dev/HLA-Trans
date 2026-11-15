import { describe, expect, it } from "vitest"
import { donorSections } from "@/components/donor/donor-form"
import { patientSections } from "@/components/patient/patient-form"
import { MISSING_FIELD_FALLBACK, MISSING_FIELD_TARGETS } from "@/domain/missing-fields"

/** `<section id="pair-inputs">` in src/components/evaluation/pair-inputs-form.tsx. */
const PAIR_SECTIONS = ["pair-inputs"]

const sectionIds = {
  patient: patientSections.map((s) => s.id),
  donor: donorSections.map((s) => s.id),
  pair: PAIR_SECTIONS,
}

describe("missing-field routing targets", () => {
  it("points every table row and fallback at a real form section id", () => {
    const targets = [
      ...MISSING_FIELD_TARGETS.map(([prefix, t]) => ({ key: prefix, ...t })),
      ...Object.entries(MISSING_FIELD_FALLBACK).map(([rule, t]) => ({ key: `fallback:${rule}`, ...t })),
    ]
    const invalid = targets.filter((t) => !sectionIds[t.entity].includes(t.section)).map((t) => `${t.key} → ${t.entity}#${t.section}`)
    expect(invalid).toEqual([])
  })
})
