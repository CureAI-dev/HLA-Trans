import type { RuleId } from "./schema"

export type MissingFieldTarget = {
  entity: "patient" | "donor" | "pair"
  section: string
}

/**
 * Where the clinician enters the input behind each missing-data finding.
 *
 * A row matches a code when the code equals the prefix or continues it with a
 * "." (so `donorHeart.vasoactiveDose` matches `donorHeart.vasoactiveDose.0`).
 * The longest matching prefix wins. Section ids are the `FormSection` ids in
 * patient-form.tsx / donor-form.tsx, and `pair-inputs` in pair-inputs-form.tsx.
 *
 * Codes are taken from every `missingFinding` call in src/domain/rules on the
 * current engine. Keep this table complete when a rule gains a missing code.
 */
export const MISSING_FIELD_TARGETS: ReadonlyArray<
  readonly [prefix: string, target: MissingFieldTarget]
> = [
  // ABO
  ["abo.missing", { entity: "patient", section: "blood" }],
  ["abo.age", { entity: "patient", section: "identity" }],
  ["abo.anti-A", { entity: "patient", section: "blood" }],
  ["abo.anti-B", { entity: "patient", section: "blood" }],
  ["abo.titerDate", { entity: "patient", section: "blood" }],
  // Size
  ["size.age", { entity: "patient", section: "identity" }],
  ["size.weight", { entity: "patient", section: "body" }],
  ["size.pvr", { entity: "patient", section: "hemodynamics" }],
  ["size.phm.pvr", { entity: "patient", section: "body" }],
  // Immunology
  ["immunology.cpra", { entity: "patient", section: "sensitization" }],
  ["immunology.specificities", { entity: "patient", section: "sensitization" }],
  ["immunology.donorTyping", { entity: "donor", section: "hla" }],
  ["immunology.unacceptable", { entity: "donor", section: "hla" }],
  ["immunology.dsa", { entity: "donor", section: "hla" }],
  // Infection
  ["infection.missing", { entity: "donor", section: "infection" }],
  ["infection.missing.recipient", { entity: "patient", section: "serology" }],
  ["infection.missing.chagasEndemicBirth", { entity: "donor", section: "history" }],
  // Donor heart
  ["donorHeart.age", { entity: "donor", section: "identity" }],
  ["donorHeart.lvef", { entity: "donor", section: "echo" }],
  ["donorHeart.wallThickness", { entity: "donor", section: "echo" }],
  ["donorHeart.wallMotion", { entity: "donor", section: "echo" }],
  ["donorHeart.valveDisease", { entity: "donor", section: "echo" }],
  ["donorHeart.rvFunction", { entity: "donor", section: "echo" }],
  ["donorHeart.congenitalAbnormality", { entity: "donor", section: "echo" }],
  ["donorHeart.coronaryAnomaly", { entity: "donor", section: "coronary" }],
  ["donorHeart.angiographyIndicated", { entity: "donor", section: "coronary" }],
  ["donorHeart.coronaryVessels", { entity: "donor", section: "coronary" }],
  ["donorHeart.ecgLvh", { entity: "donor", section: "ecg" }],
  ["donorHeart.coIschemicEcg", { entity: "donor", section: "ecg" }],
  ["donorHeart.knownCad", { entity: "donor", section: "history" }],
  ["donorHeart.priorMi", { entity: "donor", section: "history" }],
  ["donorHeart.priorCardiacSurgery", { entity: "donor", section: "history" }],
  ["donorHeart.cocaine", { entity: "donor", section: "history" }],
  ["donorHeart.diabetes", { entity: "donor", section: "history" }],
  ["donorHeart.cigarettesOver20PackYears", { entity: "donor", section: "history" }],
  ["donorHeart.malignancy", { entity: "donor", section: "history" }],
  ["donorHeart.sodiumPeak", { entity: "donor", section: "labs" }],
  ["donorHeart.sodiumLatest", { entity: "donor", section: "labs" }],
  ["donorHeart.troponinI", { entity: "donor", section: "labs" }],
  ["donorHeart.vasoactiveDose", { entity: "donor", section: "hemodynamics" }],
  ["donorHeart.cardiacArrest", { entity: "donor", section: "death" }],
  ["donorHeart.cprMinutes", { entity: "donor", section: "death" }],
  ["donorHeart.coHb", { entity: "donor", section: "death" }],
  ["donorHeart.recipientAge", { entity: "patient", section: "identity" }],
  // Logistics
  ["logistics.procurementMinutes", { entity: "pair", section: "pair-inputs" }],
  ["logistics.transportMinutes", { entity: "pair", section: "pair-inputs" }],
  ["logistics.implantMinutes", { entity: "pair", section: "pair-inputs" }],
  ["logistics.perfusionMinutes", { entity: "pair", section: "pair-inputs" }],
  ["logistics.distance", { entity: "pair", section: "pair-inputs" }],
  ["logistics.priorSternotomies", { entity: "patient", section: "history" }],
  ["logistics.donorAge", { entity: "donor", section: "identity" }],
  ["logistics.dcdFwit", { entity: "donor", section: "donation" }],
  ["logistics.dcdRecovery", { entity: "donor", section: "donation" }],
]

/** Used only when a code has no row; may point at a broader section. */
export const MISSING_FIELD_FALLBACK: Readonly<Record<RuleId, MissingFieldTarget>> = {
  abo: { entity: "patient", section: "blood" },
  size: { entity: "patient", section: "body" },
  immunology: { entity: "patient", section: "sensitization" },
  infection: { entity: "donor", section: "infection" },
  donorHeart: { entity: "donor", section: "echo" },
  logistics: { entity: "pair", section: "pair-inputs" },
}

const matches = (code: string, prefix: string) =>
  code === prefix || code.startsWith(`${prefix}.`)

/** The specific table row for a code, or null when only the fallback applies. */
export function specificMissingFieldTarget(code: string): MissingFieldTarget | null {
  let best: MissingFieldTarget | null = null
  let bestLen = -1
  for (const [prefix, target] of MISSING_FIELD_TARGETS)
    if (matches(code, prefix) && prefix.length > bestLen) {
      best = target
      bestLen = prefix.length
    }
  return best
}

export function missingFieldTarget(rule: RuleId, code: string): MissingFieldTarget {
  return specificMissingFieldTarget(code) ?? MISSING_FIELD_FALLBACK[rule]
}
