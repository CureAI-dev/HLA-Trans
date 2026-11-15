import { describe, expect, it } from "vitest"
import { DEFAULT_CRITERIA } from "../criteria"
import { PHS_RISK_VALUES } from "../options"
import { donorRiskFlags, patientRiskFlags } from "../risk-flags"
import { donor, patient } from "./builders"

const ids = (d: Parameters<typeof donorRiskFlags>[0]) => donorRiskFlags(d, DEFAULT_CRITERIA).map((f) => f.id)

describe("donorRiskFlags", () => {
  it("is empty for a clean donor", () => {
    expect(ids(donor({ echo: { lvef: 60 }, death: { cardiacArrest: "no" } }))).toEqual([])
  })
  it("flags LVEF against the active criteria and prefers the repeat echo", () => {
    expect(ids(donor({ echo: { lvef: 35, repeatLvef: null } }))).toContain("lvef.fail")
    expect(ids(donor({ echo: { lvef: 35, repeatLvef: 55 } }))).not.toContain("lvef.fail")
    expect(ids(donor({ echo: { lvef: 45 } }))).toContain("lvef.review")
    const strict = { ...DEFAULT_CRITERIA, donor: { ...DEFAULT_CRITERIA.donor, lvefPassMin: 60, lvefReviewMin: 50 } }
    expect(donorRiskFlags(donor({ echo: { lvef: 45 } }), strict).map((f) => f.id)).toContain("lvef.fail")
  })
  it("flags arrest with CPR minutes, CO, stimulants, DCD, PHS and positive serology", () => {
    const f = ids(donor({
      echo: { lvef: 60 },
      death: { cardiacArrest: "yes", cprMinutes: 40, carbonMonoxidePoisoning: true },
      history: { cocaine: "yes", phsRiskCriteria: [PHS_RISK_VALUES[0]] },
      donation: { type: "dcd" },
      infection: { serology: { hcvNat: "positive" } },
    }))
    expect(f).toEqual(expect.arrayContaining(["arrest", "co", "cocaine", "dcd", "phs", "serology.hcvNat"]))
  })
  it("grades arrest by CPR duration and treats unknown CPR as needing review", () => {
    const sev = (cprMinutes: number | null) =>
      donorRiskFlags(donor({ echo: { lvef: 60 }, death: { cardiacArrest: "yes", cprMinutes } }), DEFAULT_CRITERIA).find((x) => x.id === "arrest")?.severity
    expect(sev(10)).toBe("info")
    expect(sev(40)).toBe("review")
    expect(sev(null)).toBe("review")
  })
  it("counts distinct vasoactive agents like the engine (vasopressin excluded)", () => {
    const withAgents = (agents: Array<"norepinephrine" | "dopamine" | "vasopressin">) =>
      ids(donor({ echo: { lvef: 60 }, death: { cardiacArrest: "no" }, hemodynamics: { vasoactives: agents.map((agent, i) => ({ id: `v${i}`, agent, dose: 0.1 })) } }))
    expect(withAgents(["norepinephrine", "vasopressin"])).not.toContain("vasoactives")
    expect(withAgents(["norepinephrine", "norepinephrine"])).not.toContain("vasoactives")
    expect(withAgents(["norepinephrine", "dopamine"])).toContain("vasoactives")
  })
  it("treats an unrecorded LVEF as missing, never as normal", () => {
    expect(ids(donor({ echo: { lvef: null, repeatLvef: null } }))).toContain("lvef.missing")
  })
  it("points every flag at a donor form section", () => {
    const sections = new Set(["identity", "body", "blood", "donation", "death", "history", "hemodynamics", "echo", "coronary", "ecg", "labs", "infection", "hla", "notes"])
    const flags = donorRiskFlags(donor({
      echo: { lvef: null },
      death: { cardiacArrest: "yes", carbonMonoxidePoisoning: true },
      history: { cocaine: "yes", amphetamines: "yes", knownCad: "yes", phsRiskCriteria: [PHS_RISK_VALUES[0]] },
      donation: { type: "dcd" },
      hemodynamics: { vasoactives: [{ id: "a", agent: "dopamine", dose: 5 }, { id: "b", agent: "epinephrine", dose: 0.1 }] },
      infection: { serology: { antiHbc: "positive" } },
    }), DEFAULT_CRITERIA)
    expect(flags.length).toBeGreaterThanOrEqual(10)
    expect(flags.filter((f) => !sections.has(f.section))).toEqual([])
  })
})

const NOW = new Date("2026-11-14T00:00:00Z")

/** A candidate with nothing to flag: verified ABO, low cPRA, normal PVR. */
function cleanPatient(overrides: Parameters<typeof patient>[0] = {}) {
  return patient({
    blood: { abo: "A", verifiedTwoSamples: true },
    sensitization: { cpra: 0 },
    hemodynamics: { paMean: 25, pcwp: 15, cardiacOutput: 5 },
    ...overrides,
  })
}
const pIds = (p: Parameters<typeof patientRiskFlags>[0]) => patientRiskFlags(p, NOW, DEFAULT_CRITERIA).map((f) => f.id)

describe("patientRiskFlags", () => {
  it("is empty for a clean candidate", () => {
    expect(pIds(cleanPatient())).toEqual([])
  })
  it("flags mechanical circulatory support", () => {
    const flags = patientRiskFlags(cleanPatient({ support: { device: "lvad_durable" } }), NOW, DEFAULT_CRITERIA)
    expect(flags.map((f) => f.id)).toEqual(["mcs"])
    expect(flags[0].section).toBe("support")
  })
  it("flags cPRA above the active sensitization threshold and treats missing cPRA as missing", () => {
    expect(pIds(cleanPatient({ sensitization: { cpra: 10 } }))).not.toContain("cpra.high")
    expect(pIds(cleanPatient({ sensitization: { cpra: 11 } }))).toContain("cpra.high")
    const strict = { ...DEFAULT_CRITERIA, immunology: { ...DEFAULT_CRITERIA.immunology, cpraSensitizedMin: 50 } }
    expect(patientRiskFlags(cleanPatient({ sensitization: { cpra: 30 } }), NOW, strict).map((f) => f.id)).not.toContain("cpra.high")
    expect(pIds(cleanPatient({ sensitization: { cpra: null } }))).toContain("cpra.missing")
  })
  it("lists unacceptable antigens", () => {
    const flag = patientRiskFlags(cleanPatient({ sensitization: { unacceptableAntigens: ["A2", "B44"] } }), NOW, DEFAULT_CRITERIA).find((f) => f.id === "unacceptable")
    expect(flag?.detail).toBe("A2, B44")
  })
  it("flags PVR above the size-rule threshold, prefers the post-challenge value, and never treats missing PVR as normal", () => {
    // TPG 20 / CO 4 = 5 WU > 4 WU
    expect(pIds(cleanPatient({ hemodynamics: { paMean: 35, pcwp: 15, cardiacOutput: 4 } }))).toContain("pvr.high")
    expect(pIds(cleanPatient({ hemodynamics: { paMean: 35, pcwp: 15, cardiacOutput: 4, vasodilatorChallengeDone: true, pvrAfterChallenge: 2.5 } }))).not.toContain("pvr.high")
    expect(pIds(cleanPatient({ hemodynamics: { paMean: null, pcwp: null, cardiacOutput: null } }))).toContain("pvr.missing")
  })
  it("flags ABO that is missing or not verified on two samples", () => {
    expect(pIds(cleanPatient({ blood: { abo: "O", verifiedTwoSamples: false } }))).toContain("abo.unverified")
    expect(pIds(cleanPatient({ blood: { abo: null, verifiedTwoSamples: false } }))).toContain("abo.missing")
  })
  it("flags listing status expiring within 7 days or already expired", () => {
    const at = (statusExpiresOn: string) => pIds(cleanPatient({ listing: { statusExpiresOn } }))
    expect(at("2026-11-21")).toContain("status.expiring")
    expect(at("2026-11-14")).toContain("status.expiring")
    expect(at("2026-11-22")).not.toContain("status.expiring")
    expect(at("2026-11-13")).toContain("status.expired")
    expect(at("")).toEqual([])
  })
  it("points every flag at a patient form section", () => {
    const sections = new Set(["identity", "listing", "body", "blood", "diagnosis", "hemodynamics", "support", "function", "labs", "history", "sensitization", "acceptance", "hla", "serology", "notes"])
    const flags = patientRiskFlags(patient({
      support: { device: "tah" },
      sensitization: { cpra: 90, unacceptableAntigens: ["A2"] },
      hemodynamics: { paMean: 45, pcwp: 15, cardiacOutput: 3 },
      blood: { abo: "B", verifiedTwoSamples: false },
      listing: { statusExpiresOn: "2026-11-15" },
    }), NOW, DEFAULT_CRITERIA)
    expect(flags.map((f) => f.id).sort()).toEqual(["abo.unverified", "cpra.high", "mcs", "pvr.high", "status.expiring", "unacceptable"])
    expect(flags.filter((f) => !sections.has(f.section))).toEqual([])
  })
})
