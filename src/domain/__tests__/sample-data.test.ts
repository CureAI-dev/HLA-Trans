import { describe, expect, it } from "vitest"
import { patientSchema, donorSchema, pairInputsSchema } from "../schema"
import { DEFAULT_CRITERIA } from "../criteria"
import { evaluate } from "../engine"
import { effectivePvr, ageInYearsExact } from "../calc"
import {
  SAMPLE_PATIENTS,
  SAMPLE_DONORS,
  SAMPLE_PAIRS,
  SAMPLE_NOW,
} from "../sample-data"

describe("fictional sample dataset", () => {
  it("preserves the specified teaching profiles", () => {
    expect(SAMPLE_PATIENTS.map((p) => p.listing.urgencyStatus)).toEqual([
      "A1",
      "A2",
      "A3",
      "A4",
      "P1A",
      "A6",
    ])
    expect(SAMPLE_PATIENTS.map((p) => p.blood.abo)).toEqual([
      "O",
      "A",
      "B",
      "AB",
      "B",
      "O",
    ])
    expect(SAMPLE_PATIENTS[0].support.device).toBe("va_ecmo")
    expect(SAMPLE_PATIENTS[1].sensitization).toMatchObject({
      cpra: 78,
      unacceptableAntigens: ["A9"],
    })
    expect(
      SAMPLE_PATIENTS[1].sensitization.antibodies.map((a) => [a.antigen, a.mfi])
    ).toEqual([
      ["A24", 8000],
      ["B62", 3500],
    ])
    expect(SAMPLE_PATIENTS[2].history.priorSternotomies).toBe(1)
    expect(effectivePvr(SAMPLE_PATIENTS[3])).toBe(4.8)
    expect(
      ageInYearsExact(SAMPLE_PATIENTS[4].identity.dateOfBirth, SAMPLE_NOW)
    ).toBeCloseTo(0.6, 1)
    expect(SAMPLE_PATIENTS[4].blood.acceptsIncompatible).toBe(true)
    expect(SAMPLE_PATIENTS[5].listing.state).toBe("inactive")
    expect(SAMPLE_DONORS.map((d) => d.identity.ageYears)).toEqual([
      28, 52, 34, 31, 46,
    ])
    expect(SAMPLE_DONORS[1].echo.lvef).toBe(45)
    expect(SAMPLE_DONORS[1].coronary.vesselsOver50).toBe(1)
    expect(SAMPLE_DONORS[2].infection.serology.hcvNat).toBe("positive")
    expect(SAMPLE_DONORS[3].donation).toMatchObject({
      type: "dcd",
      functionalWarmIschemiaMinutes: 24,
      dcdRecovery: "ta_nrp",
    })
    expect(SAMPLE_DONORS[4].death.carboxyhemoglobinPct).toBe(22)
    expect(SAMPLE_DONORS[4].labs.troponinIPeak).toBe(0.4)
  })
  it("has six patients and five donors with stable unique ids and clear labels", () => {
    expect(SAMPLE_PATIENTS).toHaveLength(6)
    expect(SAMPLE_DONORS).toHaveLength(5)
    for (const records of [SAMPLE_PATIENTS, SAMPLE_DONORS]) {
      expect(new Set(records.map((record) => record.id)).size).toBe(
        records.length
      )
      for (const record of records) expect(record.notes).toMatch(/fictional/i)
    }
    for (const record of SAMPLE_PATIENTS)
      expect(patientSchema.safeParse(record).success).toBe(true)
    for (const record of SAMPLE_DONORS)
      expect(donorSchema.safeParse(record).success).toBe(true)
  })

  it("validates every pair and reproduces each documented verdict with the real engine", () => {
    const coverage = new Map<string, Set<string>>()
    expect(SAMPLE_PAIRS.length).toBeGreaterThanOrEqual(8)
    expect(new Set(SAMPLE_PAIRS.map((pair) => pair.expected))).toEqual(
      new Set(["pass", "review", "fail"])
    )
    for (const sample of SAMPLE_PAIRS) {
      const patient = SAMPLE_PATIENTS.find(
        (record) => record.id === sample.patientId
      )!
      const donor = SAMPLE_DONORS.find(
        (record) => record.id === sample.donorId
      )!
      expect(patient).toBeDefined()
      expect(donor).toBeDefined()
      expect(pairInputsSchema.safeParse(sample.pair).success).toBe(true)
      const result = evaluate({
        patient,
        donor,
        pair: sample.pair,
        criteria: DEFAULT_CRITERIA,
        now: SAMPLE_NOW,
      })
      expect(result.overall, sample.why).toBe(sample.expected)
      if (sample.expected === "pass") expect(result.missingCount).toBe(0)
      for (const rule of result.rules) {
        if (!coverage.has(rule.rule)) coverage.set(rule.rule, new Set())
        coverage.get(rule.rule)!.add(rule.status)
      }
    }
    expect([...coverage.keys()].sort()).toEqual([
      "abo",
      "donorHeart",
      "immunology",
      "infection",
      "logistics",
      "size",
    ])
    for (const [rule, statuses] of coverage)
      expect(statuses, rule).toEqual(new Set(["pass", "review", "fail"]))
  })
})
