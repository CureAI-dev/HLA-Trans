import { describe, expect, it } from "vitest"
import { DEFAULT_CRITERIA } from "../criteria"
import { evaluate } from "../engine"
import { defaultPairInputs, emptyDonor, emptyPatient } from "../factories"
import {
  MISSING_FIELD_FALLBACK,
  MISSING_FIELD_TARGETS,
  missingFieldTarget,
  specificMissingFieldTarget,
} from "../missing-fields"
import type { Donor, PairInputs, Patient, RuleId } from "../schema"

const NOW = new Date("2026-11-14T00:00:00Z")

function missingCodes(patient: Patient, donor: Donor, pair: PairInputs = defaultPairInputs()) {
  const r = evaluate({ patient, donor, pair, criteria: DEFAULT_CRITERIA, now: NOW })
  return r.rules.flatMap((rule) =>
    rule.findings.filter((f) => f.missing).map((f) => ({ rule: rule.rule, code: f.code }))
  )
}

/** Records built to reach every missing-data branch in src/domain/rules. */
function scenarios(): Array<Array<{ rule: RuleId; code: string }>> {
  const out: Array<Array<{ rule: RuleId; code: string }>> = []
  out.push(missingCodes(emptyPatient(NOW), emptyDonor(NOW)))

  // Adult recipient with no size data, a pending vasodilator PVR; older donor with many gaps.
  {
    const p = emptyPatient(NOW)
    p.identity.dateOfBirth = "1970-01-01"
    p.blood.abo = "A"
    p.hemodynamics.vasodilatorChallengeDone = true
    p.sensitization.cpra = 50
    p.acceptance.maxDistanceNm = 500
    const d = emptyDonor(NOW)
    d.identity.ageYears = 55
    d.blood.abo = "A"
    d.coronary.angiography = "abnormal"
    d.death.cardiacArrest = "yes"
    d.death.carbonMonoxidePoisoning = true
    d.hemodynamics.vasoactives = [{ id: "v1", agent: "norepinephrine", dose: null }]
    d.donation.type = "dcd"
    d.infection.serology.hivNat = "positive"
    const pair = { ...defaultPairInputs(), preservation: "ocs_normothermic" as const }
    out.push(missingCodes(p, d, pair))
  }
  // Older donor, recipient with no birth date (recipientAge); angiography indicated.
  {
    const d = emptyDonor(NOW)
    d.identity.ageYears = 55
    out.push(missingCodes(emptyPatient(NOW), d))
  }
  // Pulmonary hypertension without PHM inputs.
  {
    const p = emptyPatient(NOW)
    p.identity.dateOfBirth = "1970-01-01"
    p.hemodynamics.vasodilatorChallengeDone = true
    p.hemodynamics.pvrAfterChallenge = 6
    out.push(missingCodes(p, emptyDonor(NOW)))
  }
  // Pediatric recipient: size by weight; ABO-incompatible pathway without titers.
  {
    const p = emptyPatient(NOW)
    p.identity.dateOfBirth = "2020-01-01"
    p.blood.abo = "O"
    p.blood.acceptsIncompatible = true
    const d = emptyDonor(NOW)
    d.blood.abo = "A"
    out.push(missingCodes(p, d))
  }
  // Incompatible pathway with no birth date: age missing.
  {
    const p = emptyPatient(NOW)
    p.blood.abo = "O"
    p.blood.acceptsIncompatible = true
    const d = emptyDonor(NOW)
    d.blood.abo = "B"
    out.push(missingCodes(p, d))
  }
  // Antibodies and unacceptable antigens against an untyped donor.
  {
    const p = emptyPatient(NOW)
    p.sensitization.antibodies = [{ id: "a1", antigen: "A2", mfi: 9000, c1q: "not_done", testDate: "" }]
    p.sensitization.unacceptableAntigens = ["B44"]
    out.push(missingCodes(p, emptyDonor(NOW)))
  }
  return out
}

const allMissing = () => scenarios().flat()

describe("missingFieldTarget", () => {
  it("routes every missing finding from blank records to a section", () => {
    const missing = missingCodes(emptyPatient(NOW), emptyDonor(NOW))
    expect(missing.length).toBeGreaterThan(0)
    for (const m of missing) {
      const t = missingFieldTarget(m.rule, m.code)
      expect(t.section, `${m.rule}/${m.code}`).not.toBe("")
    }
  })

  it("has a specific row (not the fallback) for every code the engine emits", () => {
    const unrouted = [...new Set(allMissing().filter((m) => specificMissingFieldTarget(m.code) === null).map((m) => m.code))]
    expect(unrouted).toEqual([])
  })

  it("exercises the missing-data branches it claims to cover", () => {
    const codes = new Set(allMissing().map((m) => m.code))
    const expected = [
      "abo.missing", "abo.age", "abo.anti-A.missing", "abo.anti-B.missing", "abo.titerDate",
      "size.age.missing", "size.weight.missing", "size.pvr.missing", "size.phm.pvr.missing",
      "immunology.cpra", "immunology.specificities", "immunology.donorTyping",
      "immunology.unacceptable.0", "immunology.dsa.0",
      "infection.missing.hivAbAg", "infection.missing.recipient.hiv", "infection.missing.recipient.cmvIgG",
      "infection.missing.chagasEndemicBirth", "infection.missing.bloodCulture", "infection.missing.cnsInfection",
      "donorHeart.age", "donorHeart.lvef", "donorHeart.coronaryVessels", "donorHeart.angiographyIndicated",
      "donorHeart.cprMinutes", "donorHeart.coHb", "donorHeart.coIschemicEcg", "donorHeart.vasoactiveDose.0",
      "donorHeart.recipientAge", "donorHeart.malignancy", "donorHeart.troponinI",
      "logistics.procurementMinutes", "logistics.perfusionMinutes", "logistics.distance",
      "logistics.priorSternotomies", "logistics.donorAge", "logistics.dcdFwit", "logistics.dcdRecovery",
    ]
    expect(expected.filter((c) => !codes.has(c))).toEqual([])
  })

  it("routes representative codes to the section where the input is entered", () => {
    expect(missingFieldTarget("infection", "infection.missing.recipient.cmvIgG")).toEqual({ entity: "patient", section: "serology" })
    expect(missingFieldTarget("infection", "infection.missing.chagasEndemicBirth")).toEqual({ entity: "donor", section: "history" })
    expect(missingFieldTarget("infection", "infection.missing.hcvNat")).toEqual({ entity: "donor", section: "infection" })
    expect(missingFieldTarget("donorHeart", "donorHeart.vasoactiveDose.2")).toEqual({ entity: "donor", section: "hemodynamics" })
    expect(missingFieldTarget("donorHeart", "donorHeart.recipientAge")).toEqual({ entity: "patient", section: "identity" })
    expect(missingFieldTarget("size", "size.phm.pvr.missing")).toEqual({ entity: "patient", section: "body" })
    expect(missingFieldTarget("size", "size.pvr.missing")).toEqual({ entity: "patient", section: "hemodynamics" })
    expect(missingFieldTarget("logistics", "logistics.transportMinutes")).toEqual({ entity: "pair", section: "pair-inputs" })
    expect(missingFieldTarget("logistics", "logistics.dcdFwit")).toEqual({ entity: "donor", section: "donation" })
  })

  it("matches whole code segments only and falls back per rule", () => {
    expect(specificMissingFieldTarget("donorHeart.ageing")).toBeNull()
    expect(missingFieldTarget("donorHeart", "donorHeart.somethingNew")).toEqual(MISSING_FIELD_FALLBACK.donorHeart)
  })

  it("has no duplicate prefixes", () => {
    const prefixes = MISSING_FIELD_TARGETS.map(([p]) => p)
    expect(new Set(prefixes).size).toBe(prefixes.length)
  })
})
