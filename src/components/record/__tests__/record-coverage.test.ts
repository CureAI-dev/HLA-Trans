import { describe, expect, it } from "vitest"
import { donorSections } from "@/components/donor/donor-form"
import { patientSections } from "@/components/patient/patient-form"
import { emptyDonor, emptyPatient } from "@/domain/factories"
import { donorRecordSections } from "../donor-record"
import { patientRecordSections } from "../patient-record"
import { formatRecordValue, getAtPath, isBlank, leafPaths } from "../record-spec"
import type { RecordField } from "../record-spec"

/** Metadata that is shown in the page header, not the clinical record. */
const IGNORED = new Set(["id", "createdAt", "updatedAt"])

function covered(sections: typeof donorRecordSections) {
  return new Set(sections.flatMap((s) => s.fields.map((f) => f.path)))
}

describe("clinical record coverage", () => {
  it("shows every donor field", () => {
    const missing = leafPaths(emptyDonor()).filter((p) => !IGNORED.has(p) && !covered(donorRecordSections).has(p))
    expect(missing).toEqual([])
  })
  it("shows every patient field", () => {
    const missing = leafPaths(emptyPatient()).filter((p) => !IGNORED.has(p) && !covered(patientRecordSections).has(p))
    expect(missing).toEqual([])
  })
  it("lists only real paths, each once", () => {
    for (const [sections, record] of [
      [donorRecordSections, emptyDonor()],
      [patientRecordSections, emptyPatient()],
    ] as const) {
      const paths = sections.flatMap((s) => s.fields.map((f) => f.path))
      const leaves = new Set(leafPaths(record))
      expect(paths.filter((p) => !leaves.has(p))).toEqual([])
      expect(new Set(paths).size).toBe(paths.length)
    }
  })
  it("uses the form's section ids in the form's order", () => {
    expect(donorRecordSections.map((s) => s.id)).toEqual(donorSections.map((s) => s.id))
    expect(patientRecordSections.map((s) => s.id)).toEqual(patientSections.map((s) => s.id))
    expect(donorRecordSections.map((s) => s.title)).toEqual(donorSections.map((s) => s.title))
    expect(patientRecordSections.map((s) => s.title)).toEqual(patientSections.map((s) => s.title))
  })
})

const field = (sections: typeof donorRecordSections, path: string): RecordField => {
  const f = sections.flatMap((s) => s.fields).find((x) => x.path === path)
  if (!f) throw new Error(`no field ${path}`)
  return f
}
const show = (sections: typeof donorRecordSections, record: unknown, path: string) => {
  const v = getAtPath(record, path)
  return isBlank(v) ? "Not recorded" : formatRecordValue(field(sections, path), v)
}

describe("record display", () => {
  it("renders antibody rows as antigen, MFI and C1q instead of JSON", () => {
    const p = emptyPatient()
    p.sensitization.antibodies = [
      { id: "a1", antigen: "A2", mfi: 9000, c1q: "positive", testDate: "" },
      { id: "a2", antigen: "DQ7", mfi: 2500, c1q: "not_done", testDate: "2026-10-01" },
    ]
    expect(show(patientRecordSections, p, "sensitization.antibodies")).toBe("A2 MFI 9000 (C1q positive)\nDQ7 MFI 2500 (C1q not done, Oct 1, 2026)")
  })
  it("renders vasoactives with agent, dose and unit", () => {
    const d = emptyDonor()
    d.hemodynamics.vasoactives = [
      { id: "v1", agent: "norepinephrine", dose: 0.1 },
      { id: "v2", agent: "vasopressin", dose: null },
    ]
    expect(show(donorRecordSections, d, "hemodynamics.vasoactives")).toBe("Norepinephrine 0.1 mcg/kg/min\nVasopressin dose not recorded")
  })
  it("treats unknowns as unknown, blanks as not recorded and false as No", () => {
    const d = emptyDonor()
    expect(show(donorRecordSections, d, "echo.lvef")).toBe("Not recorded")
    expect(show(donorRecordSections, d, "hla.A")).toBe("Not recorded")
    d.death.cardiacArrest = "unknown"
    expect(show(donorRecordSections, d, "death.cardiacArrest")).toBe("Unknown")
    d.death.carbonMonoxidePoisoning = false
    expect(show(donorRecordSections, d, "death.carbonMonoxidePoisoning")).toBe("No")
    d.coronary.vesselsOver50 = 0
    expect(show(donorRecordSections, d, "coronary.vesselsOver50")).toBe("0 count")
  })
  it("labels option values, lists and HLA pairs", () => {
    const d = emptyDonor()
    d.history.phsRiskCriteria = ["msm"]
    expect(show(donorRecordSections, d, "history.phsRiskCriteria")).toBe("Man who has had sex with another man")
    d.infection.serology.hcvNat = "positive"
    expect(show(donorRecordSections, d, "infection.serology.hcvNat")).toBe("Positive")
    d.hla.A = ["A*02:01", ""]
    expect(show(donorRecordSections, d, "hla.A")).toBe("A*02:01")
    d.echo.echoDate = "2026-11-03"
    expect(show(donorRecordSections, d, "echo.echoDate")).toBe("Nov 3, 2026")
  })
})
