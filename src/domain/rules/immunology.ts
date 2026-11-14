import { abDrMismatches, buildProfile, donorCarries, parseHla } from "../hla"
import type { Finding, Outcome, RuleResult } from "../schema"
import type { RuleContext } from "./context"
import { finding, missingFinding, ruleResult } from "./findings"

const SOURCE = "WHO HLA equivalence / OPTN Policy 4.11; center practice"
const severity = { fail: 0, review: 1, pass: 2, info: 3 }

/** Virtual crossmatch screening; physical crossmatch is independently reported. */
export function evaluateImmunology(ctx: RuleContext): RuleResult {
  const { patient, donor, pair } = ctx
  const criteria = ctx.criteria.immunology
  const findings: Array<Finding> = []
  const profile = buildProfile(donor.hla)
  const sensitization = patient.sensitization
  const add = (
    code: string,
    status: Finding["status"],
    title: string,
    detail: string,
    evidence: string
  ) => {
    findings.push(
      finding({
        code: `immunology.${code}`,
        status,
        title,
        detail,
        evidence,
        source: SOURCE,
      })
    )
  }
  for (const [owner, p] of [
    ["donor", profile],
    ["patient", buildProfile(patient.hla)],
  ] as const) {
    p.invalid.forEach((entry, i) =>
      add(
        `invalid.${owner}.${i}`,
        "review",
        `Invalid ${owner} HLA entry`,
        `${entry.error} Locus ${entry.locus}; raw entry: ${entry.value}`,
        entry.value
      )
    )
  }
  profile.nullAlleles.forEach((allele, i) =>
    add(
      `null.${i}`,
      "info",
      "Donor null allele excluded",
      "Null alleles are not expressed and are excluded from the antigen set.",
      allele
    )
  )

  const untyped = (target: string) => {
    const parsed = parseHla(target)
    if (!parsed.ok) return false
    const spec = parsed.spec
    if (spec.kind === "bw")
      return (
        (spec.antigen === "Bw4" ? profile.bw4 : profile.bw6) === null &&
        !profile.families.B.typed
      )
    const fam = profile.families[spec.family]
    const gene =
      spec.kind === "allele"
        ? spec.gene
        : { DR51: "DRB5", DR52: "DRB3", DR53: "DRB4" }[spec.antigen]
    return (
      !fam.typed ||
      (spec.family === "DR5x" && !!gene && !fam.typedGenes.has(gene))
    )
  }

  sensitization.unacceptableAntigens.forEach((target, i) => {
    const hit = donorCarries(target, profile)
    if (hit.reactivity === "none") return
    if (untyped(target)) {
      findings.push(
        missingFinding(
          `immunology.unacceptable.${i}`,
          "Donor typing missing for unacceptable antigen",
          hit.reason,
          SOURCE
        )
      )
      return
    }
    add(
      `unacceptable.${i}`,
      hit.reactivity === "definite"
        ? criteria.unacceptableAntigenOutcome
        : "review",
      `${hit.reactivity === "possible" ? "Possible unacceptable" : "Unacceptable"} antigen: ${target}`,
      hit.reason,
      target
    )
  })

  let belowReview = 0
  sensitization.antibodies.forEach((antibody, i) => {
    const { antigen, mfi, c1q } = antibody
    // Invalid specificities must remain visible even below the MFI threshold.
    if (!parseHla(antigen).ok) {
      add(
        `invalid.antibody.${i}`,
        "review",
        "Invalid antibody specificity",
        donorCarries(antigen, profile).reason,
        antigen
      )
      return
    }
    if (mfi < criteria.mfiReviewMin) {
      belowReview++
      return
    }
    const hit = donorCarries(antigen, profile)
    if (hit.reactivity === "none") return
    if (untyped(antigen)) {
      findings.push(
        missingFinding(
          `immunology.dsa.${i}`,
          "Donor typing missing for antibody",
          hit.reason,
          SOURCE
        )
      )
      return
    }
    let status: Outcome =
      hit.reactivity === "possible"
        ? "review"
        : mfi >= criteria.mfiFailMin
          ? "fail"
          : "review"
    if (
      hit.reactivity === "definite" &&
      c1q === "positive" &&
      severity[criteria.c1qPositiveOutcome] < severity[status]
    )
      status = criteria.c1qPositiveOutcome
    add(
      `dsa.${i}`,
      status,
      `${hit.reactivity === "possible" ? "Possible DSA" : "DSA"}: ${antigen}`,
      hit.reason,
      `${antigen}; MFI ${mfi}; C1q ${c1q}`
    )
  })
  if (belowReview)
    add(
      "belowReview",
      "info",
      `${belowReview} ${belowReview === 1 ? "antibody" : "antibodies"} below review level`,
      "Antibodies below the configured MFI review level are ignored.",
      `${belowReview}; MFI < ${criteria.mfiReviewMin}`
    )

  const hasSpecificities =
    sensitization.antibodies.length > 0 ||
    sensitization.unacceptableAntigens.length > 0
  if (
    hasSpecificities &&
    !Object.values(profile.families).some((f) => f.typed) &&
    profile.bw4 === null &&
    profile.bw6 === null
  ) {
    findings.push(
      missingFinding(
        "immunology.donorTyping",
        "Donor HLA typing missing",
        "Antibodies or unacceptable antigens are listed, but donor typing is unavailable.",
        SOURCE
      )
    )
  }
  if (!sensitization.antibodies.length) {
    if (sensitization.cpra === null)
      findings.push(
        missingFinding(
          "immunology.cpra",
          "cPRA missing",
          "No antibody specificities are listed and cPRA is not recorded.",
          SOURCE
        )
      )
    else if (sensitization.cpra > criteria.cpraSensitizedMin)
      findings.push(
        missingFinding(
          "immunology.specificities",
          "Antibody specificities missing",
          `cPRA ${sensitization.cpra}% exceeds ${criteria.cpraSensitizedMin}%; list antibody specificities.`,
          SOURCE
        )
      )
  }
  for (const [kind, value, outcome] of [
    ["cdc", pair.cdcCrossmatch, criteria.cdcCrossmatchPositiveOutcome],
    ["flow", pair.flowCrossmatch, criteria.flowCrossmatchPositiveOutcome],
  ] as const) {
    if (value === "positive")
      add(
        `crossmatch.${kind}`,
        outcome,
        `Positive ${kind === "cdc" ? "CDC" : "flow"} crossmatch`,
        "Physical crossmatch is positive.",
        value
      )
  }
  const mismatch = abDrMismatches(donor.hla, patient.hla)
  if (mismatch)
    add(
      "mismatches",
      "info",
      "A/B/DR mismatch count",
      "Informational serologic mismatch count; does not determine suitability.",
      `A ${mismatch.A}; B ${mismatch.B}; DR ${mismatch.DR}; total ${mismatch.total}`
    )
  if (!findings.some((f) => f.status !== "info"))
    add(
      "screen",
      "pass",
      "No actionable donor-specific antibody finding",
      "No actionable antibody or unacceptable-antigen reactivity was identified with the available typing and configured criteria.",
      `cPRA ${sensitization.cpra ?? "not recorded"}`
    )
  findings.sort((a, b) => severity[a.status] - severity[b.status])
  return ruleResult("immunology", findings)
}
