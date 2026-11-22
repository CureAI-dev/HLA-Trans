import { describe, expect, test } from "vitest"
import {
  abDrMismatches,
  alleleToSerologic,
  buildProfile,
  donorCarries,
  normalizeHla,
  parseHla,
  withAncestors,
} from "../hla"
import { emptyHlaTyping } from "../factories"
import type { HlaLocus, HlaTyping } from "../schema"

function typing(loci: Partial<Record<HlaLocus, [string, string]>>, extra?: Partial<HlaTyping>): HlaTyping {
  return { ...emptyHlaTyping(), ...loci, ...extra }
}

describe("parseHla / normalizeHla", () => {
  test.each<[string, HlaLocus | undefined, string]>([
    ["a2", undefined, "A2"],
    ["2", "A", "A2"],
    ["02:01", "A", "A*02:01"],
    ["HLA-A*02:01:01:02L", undefined, "A*02:01L"],
    ["cw9", undefined, "Cw9"],
    ["9", "C", "Cw9"],
    ["DR15", undefined, "DR15"],
    ["15", "DRB1", "DR15"],
    ["7", "DQB1", "DQ7"],
    ["4*01:01", "DRB345", "DRB4*01:01"],
    ["52", "DRB345", "DR52"],
    ["DPB1*04:01", undefined, "DPB1*04:01"],
    ["04:01", "DPB1", "DPB1*04:01"],
    ["A*24:09N", undefined, "A*24:09N"],
    ["Bw4", undefined, "Bw4"],
    ["  b 44 ", undefined, "B44"],
  ])("%s (locus %s) → %s", (input, locus, expected) => {
    expect(normalizeHla(input, locus)).toBe(expected)
  })

  test("unknown serologic antigen is rejected with a clear message", () => {
    const r = parseHla("A99")
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain("not a recognized serologic antigen")
  })

  test.each(["xyz", "", "A*", "B-44"])("garbage %j is rejected", (input) => {
    expect(parseHla(input).ok).toBe(false)
  })
})

describe("allele → serologic", () => {
  test.each<[string, string, string | null, string | null]>([
    ["B", "15", "01", "B62"],
    ["B", "15", "03", "B72"],
    ["B", "15", "99", "B15"],
    ["B", "40", "05", "B4005"],
    ["C", "03", "03", "Cw9"],
    ["DRB1", "03", "01", "DR17"],
    ["DQB1", "03", "02", "DQ8"],
    ["DRB4", "01", "01", "DR53"],
    ["A", "24", "02", "A24"],
    ["DPB1", "04", "01", null],
  ])("%s*%s:%s → %s", (gene, group, protein, expected) => {
    expect(alleleToSerologic(gene, group, protein)).toBe(expected)
  })
})

describe("equivalence (WHO + OPTN overrides)", () => {
  test("B71 ⊂ B70 ⊂ B15", () => expect(withAncestors("B71")).toEqual(["B71", "B70", "B15"]))
  test("A43 ⊂ A10", () => expect(withAncestors("A43")).toEqual(["A43", "A10"]))
  test("B4005 ≡ B50 ⊂ B21", () => expect(withAncestors("B4005")).toEqual(["B4005", "B50", "B21"]))
  test("standalone antigen has no ancestors", () => expect(withAncestors("A2")).toEqual(["A2"]))
})

describe("virtual crossmatch (donorCarries)", () => {
  const profile = buildProfile(typing({ A: ["A*02:01", "A*24:02"], B: ["B15", "B44"] }))

  test.each<[string, "definite" | "possible" | "none"]>([
    ["A9", "definite"],
    ["A24", "definite"],
    ["A*24:02", "definite"],
    ["A*24:03", "none"],
    ["A23", "none"],
    ["A2", "definite"],
    ["B62", "possible"],
    ["B71", "possible"],
    ["B15", "definite"],
    ["B12", "definite"],
    ["B44", "definite"],
    ["B45", "none"],
    ["Bw4", "definite"],
    ["Cw7", "possible"],
    ["DR15", "possible"],
    ["DPB1*04:01", "possible"],
  ])("%s → %s", (target, expected) => {
    expect(donorCarries(target, profile).reactivity).toBe(expected)
  })

  test("serologic-only donor typing makes allele targets possible, not none", () => {
    const p = buildProfile(typing({ A: ["A2", "A24"] }))
    expect(donorCarries("A*24:02", p).reactivity).toBe("possible")
    expect(donorCarries("A*01:01", p).reactivity).toBe("none")
  })

  test("Bw4 is carried by HLA-A antigens A9, A23, A24, A2403, A25, A32 (WHO)", () => {
    const p = buildProfile(typing({ A: ["A24", "A2"], B: ["B7", "B8"] }))
    expect(p.bw4).toBe(true)
    expect(donorCarries("Bw4", p).reactivity).toBe("definite")
    expect(buildProfile(typing({ A: ["A*32:01", "A2"], B: ["B7", "B8"] })).bw4).toBe(true)
  })

  test("Bw4 negative only when A and B are both resolved", () => {
    expect(buildProfile(typing({ A: ["A1", "A2"], B: ["B7", "B8"] })).bw4).toBe(false)
    expect(buildProfile(typing({ B: ["B7", "B8"] })).bw4).toBeNull()
    expect(buildProfile(typing({ A: ["A19", "A2"], B: ["B7", "B8"] })).bw4).toBeNull()
    expect(buildProfile(typing({ A: ["A10", "A2"], B: ["B7", "B8"] })).bw4).toBeNull()
    expect(buildProfile(typing({ A: ["A1", "A2"], B: ["B7", "B8"] })).bw6).toBe(true)
  })

  test("Bw6 negative only when B is fully resolved", () => {
    expect(buildProfile(typing({ B: ["B44", "B57"] })).bw6).toBe(false)
    expect(buildProfile(typing({ B: ["B15", "B44"] })).bw6).toBeNull()
  })

  test("explicit Bw typing overrides derivation", () => {
    expect(buildProfile(typing({ B: ["B44", "B57"] }, { bw6: "yes" })).bw6).toBe(true)
  })

  test("unreadable target is possible, never none", () => {
    expect(donorCarries("Q12", profile).reactivity).toBe("possible")
  })
})

describe("profile", () => {
  test("unresolved broad cannot exclude an allele group", () => {
    expect(donorCarries("A*24", buildProfile(typing({ A: ["A9", ""] }))).reactivity).toBe("possible")
  })

  test("unmapped B alleles cannot establish Bw negativity", () => {
    const p = buildProfile(typing({ B: ["B*99:01", ""] }))
    expect(p.bw4).toBeNull()
    expect(p.bw6).toBeNull()
  })

  test.each(["B2708", "B*27:08"])("specific Bw assignment wins for %s", (value) => {
    const p = buildProfile(typing({ A: ["A1", "A2"], B: [value, ""] }))
    expect(p.bw4).toBe(false)
    expect(p.bw6).toBe(true)
  })

  test.each(["DRB4*01", "DRB4*01:01", "DR53"])("untyped DRB4 remains possible for %s", (target) => {
    expect(donorCarries(target, buildProfile(typing({ DRB345: ["DRB3*01:01", ""] }))).reactivity).toBe("possible")
  })

  test.each(["B44", "B*44:02", "Bw4"])("rejects %s in an A grid cell", (value) => {
    const p = buildProfile(typing({ A: [value, ""] }))
    expect(p.invalid).toHaveLength(1)
    expect(p.families.B.typed).toBe(false)
    expect(parseHla(value, "A").ok).toBe(false)
  })

  test("null allele is excluded from the antigen set", () => {
    const p = buildProfile(typing({ A: ["A*24:09N", "A*02:01"] }))
    expect(p.families.A.antigens.has("A24")).toBe(false)
    expect(p.families.A.antigens.has("A2")).toBe(true)
    expect(p.nullAlleles).toEqual(["A*24:09N"])
  })

  test("invalid entries are collected", () => {
    const p = buildProfile(typing({ A: ["Q12", "A2"] }))
    expect(p.invalid).toHaveLength(1)
    expect(p.invalid[0]?.locus).toBe("A")
  })
})

describe("A/B/DR mismatches", () => {
  test("recipient null allele does not prevent a mismatch", () => {
    const donor = typing({ A: ["A1", "A2"], B: ["B44", ""], DRB1: ["DR15", ""] })
    const recipient = typing({ A: ["A*01:01N", "A2"], B: ["B44", ""], DRB1: ["DR15", ""] })
    expect(abDrMismatches(donor, recipient)).toEqual({ A: 1, B: 0, DR: 0, total: 1 })
  })
  test("one mismatch per locus", () => {
    const donor = typing({ A: ["A1", "A2"], B: ["B8", "B44"], DRB1: ["DR15", "DR4"] })
    const recipient = typing({ A: ["A2", "A3"], B: ["B7", "B44"], DRB1: ["DR15", "DR7"] })
    expect(abDrMismatches(donor, recipient)).toEqual({ A: 1, B: 1, DR: 1, total: 3 })
  })

  test("homozygous donor counts once", () => {
    const donor = typing({ A: ["A1", ""], B: ["B8", ""], DRB1: ["DR4", ""] })
    const recipient = typing({ A: ["A2", "A3"], B: ["B7", "B44"], DRB1: ["DR15", "DR7"] })
    expect(abDrMismatches(donor, recipient)).toEqual({ A: 1, B: 1, DR: 1, total: 3 })
  })

  test("donor null allele is not counted", () => {
    const donor = typing({ A: ["A*01:01N", "A*02:01"], B: ["B44", ""], DRB1: ["DR15", ""] })
    const recipient = typing({ A: ["A2", "A3"], B: ["B44", ""], DRB1: ["DR15", ""] })
    expect(abDrMismatches(donor, recipient)).toEqual({ A: 0, B: 0, DR: 0, total: 0 })
  })

  test("untyped locus gives null", () => {
    expect(abDrMismatches(typing({ A: ["A1", ""] }), typing({ A: ["A2", ""] }))).toBeNull()
  })
})
