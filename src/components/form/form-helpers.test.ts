import { describe, expect, it } from "vitest"
import {
  parseAntibodyPaste,
  parseNumberInput,
  updateAtPath,
} from "./form-helpers"
import { parseIsoDate } from "@/domain/dates"

describe("clinical form helpers", () => {
  it("preserves valid paste rows and reports each invalid token", () => {
    const result = parseAntibodyPaste(
      "A2 8000, B44:3500; DQ7 1200; nonsense; A3 -1"
    )
    expect(result.rows.map(({ antigen, mfi }) => ({ antigen, mfi }))).toEqual([
      { antigen: "A2", mfi: 8000 },
      { antigen: "B44", mfi: 3500 },
      { antigen: "DQ7", mfi: 1200 },
    ])
    expect(result.invalidTokens).toEqual(["nonsense", "A3 -1"])
  })
  it("preserves missing numbers and refuses invalid or infinite input", () => {
    expect(parseNumberInput("")).toBeNull()
    expect(parseNumberInput("1.25")).toBe(1.25)
    expect(parseNumberInput("abc")).toBeUndefined()
    expect(parseNumberInput("Infinity")).toBeUndefined()
  })
  it("updates nested tuple values without mutating the baseline", () => {
    const original = { hla: { A: ["A2", "A3"] }, missing: null }
    const next = updateAtPath(original, "hla.A.1", "A24")
    expect(next.hla.A).toEqual(["A2", "A24"])
    expect(original.hla.A).toEqual(["A2", "A3"])
    expect(next.missing).toBeNull()
  })
})
it("rejects unknown antigen names while retaining allele colons", () => {
  const result = parseAntibodyPaste("garbage 10, DPB1*04:01 900, B44:3500")
  expect(result.invalidTokens).toEqual(["garbage 10"])
  expect(result.rows.map((row) => row.antigen)).toEqual(["DPB1*04:01", "B44"])
  expect(parseAntibodyPaste("A2 8000")).toEqual(parseAntibodyPaste("A2 8000"))
})

describe("date picker frame", () => {
  it("round-trips ISO dates across DST boundaries", () => {
    for (const iso of ["2026-03-08", "2026-03-29", "2026-10-25", "2026-11-01", "2024-02-29"]) {
      const d = parseIsoDate(iso)
      expect(d).not.toBeNull()
      if (!d) continue
      const local = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
      const back = new Date(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()))
      expect(back.toISOString().slice(0, 10)).toBe(iso)
    }
  })
})
