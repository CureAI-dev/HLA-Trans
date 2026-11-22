import { estimateIschemia } from "../calc"
import type { Finding, RuleResult } from "../schema"
import type { RuleContext } from "./context"
import { finding, missingFinding, ruleResult } from "./findings"

const SOURCE = "ISHLT donor heart selection (Copeland 2023); center practice"

export function evaluateLogistics(ctx: RuleContext): RuleResult {
  const { patient, donor, pair } = ctx
  const c = ctx.criteria.logistics
  const findings: Array<Finding> = []
  const add = (
    code: string,
    status: Finding["status"],
    title: string,
    detail: string,
    evidence: string
  ) => {
    findings.push(
      finding({
        code: `logistics.${code}`,
        status,
        title,
        detail,
        evidence,
        source: SOURCE,
      })
    )
  }
  const missing = (code: string, title: string) => {
    findings.push(
      missingFinding(
        `logistics.${code}`,
        title,
        `Record ${title.toLowerCase()} before assessing logistics.`,
        SOURCE
      )
    )
  }
  for (const [key, title] of [
    ["procurementMinutes", "Procurement time"],
    ["transportMinutes", "Transport time"],
    ["implantMinutes", "Implant time"],
  ] as const) {
    if (pair[key] === null) missing(key, title)
  }
  if (
    pair.preservation === "ocs_normothermic" &&
    pair.perfusionMinutes === null
  )
    missing("perfusionMinutes", "Normothermic perfusion time")
  if (patient.history.priorSternotomies === null)
    missing("priorSternotomies", "Prior sternotomies")
  if (donor.identity.ageYears === null) missing("donorAge", "Donor age")

  const estimate = estimateIschemia(pair, patient, c)
  if (estimate !== null) {
    add(
      "ischemia",
      estimate.coldMinutes <= c.ischemicPassMaxMinutes
        ? "pass"
        : estimate.coldMinutes <= c.ischemicReviewMaxMinutes
          ? "review"
          : "fail",
      "Estimated cold ischemic time",
      `Pass up to ${c.ischemicPassMaxMinutes} min; review up to ${c.ischemicReviewMaxMinutes} min. Includes redo sternotomy and device explant allowances.`,
      `${estimate.coldMinutes} min cold; ${estimate.totalMinutes} min total`
    )
    if (
      donor.identity.ageYears !== null &&
      donor.identity.ageYears >= c.olderDonorAge &&
      estimate.totalMinutes > c.ischemicPassMaxMinutes
    )
      add(
        "olderDonor",
        "review",
        "Older donor with prolonged total time",
        `Avoid total time above ${c.ischemicPassMaxMinutes} min with donor age ${c.olderDonorAge} years or older.`,
        `Donor ${donor.identity.ageYears} years; ${estimate.totalMinutes} min total`
      )
  }
  if (pair.preservation !== "static_cold")
    add(
      "perfusion",
      "info",
      "Machine preservation used",
      "Only normothermic OCS perfusion time is excluded from estimated cold ischemia.",
      pair.preservation
    )
  if (donor.donation.type === "dcd") {
    if (!patient.acceptance.acceptDcd)
      add(
        "dcdAcceptance",
        "fail",
        "DCD donor not accepted",
        "The candidate has not opted in to DCD hearts.",
        "DCD donor; acceptance false"
      )
    const warm = donor.donation.functionalWarmIschemiaMinutes
    if (warm === null) missing("dcdFwit", "DCD functional warm ischemia")
    else
      add(
        "dcdFwit",
        warm <= c.dcdFwitPassMaxMinutes
          ? "pass"
          : warm <= c.dcdFwitReviewMaxMinutes
            ? "review"
            : "fail",
        "DCD functional warm ischemia",
        `Pass up to ${c.dcdFwitPassMaxMinutes} min; review up to ${c.dcdFwitReviewMaxMinutes} min.`,
        `${warm} min`
      )
    if (donor.donation.dcdRecovery === null)
      missing("dcdRecovery", "DCD recovery technique")
  }
  const maxDistance = patient.acceptance.maxDistanceNm
  if (maxDistance !== null) {
    if (pair.distanceNm === null) missing("distance", "Transport distance")
    else
      add(
        "distance",
        pair.distanceNm > maxDistance ? "fail" : "pass",
        "Candidate distance limit",
        `Maximum accepted distance ${maxDistance} NM.`,
        `${pair.distanceNm} NM`
      )
  }
  return ruleResult("logistics", findings)
}
