import { ageInYears } from "../calc"
import { parseIsoDate } from "../dates"
import type { Abo } from "../options"
import type { Finding } from "../schema"
import type { RuleContext } from "./context"
import { finding, missingFinding, ruleResult } from "./findings"

const TABLE_6_4 = "OPTN 6.6.A, Table 6-4"

export function aboCompatible(donor: Abo, recipient: Abo): boolean {
  return donor === recipient || donor === "O" || recipient === "AB"
}

export function aboPriority(
  donor: Abo,
  recipient: Abo
): "primary" | "secondary" | "incompatible" {
  if (!aboCompatible(donor, recipient)) return "incompatible"
  return donor === "O" && (recipient === "A" || recipient === "AB")
    ? "secondary"
    : "primary"
}

export function evaluateAbo(ctx: RuleContext) {
  const p = ctx.patient.blood
  const d = ctx.donor.blood
  const findings: Array<Finding> = []
  const source = "OPTN 6.6.B"
  const add = (
    code: string,
    status: Finding["status"],
    title: string,
    detail: string,
    evidence = "",
    findingSource = source
  ) =>
    findings.push(
      finding({
        code: `abo.${code}`,
        status,
        title,
        detail,
        evidence,
        source: findingSource,
      })
    )
  if (p.subtype !== "none" || d.subtype !== "none")
    add(
      "subtypes",
      "info",
      "ABO subtypes",
      "Heart allocation does not use ABO subtypes.",
      `Recipient ${p.subtype}; donor ${d.subtype}`,
      TABLE_6_4
    )
  if (p.abo === null || d.abo === null) {
    findings.push(
      missingFinding(
        "abo.missing",
        "Blood type missing",
        "Record both donor and recipient ABO types.",
        source
      )
    )
    return ruleResult("abo", findings)
  }
  if (!p.verifiedTwoSamples || !d.verifiedTwoSamples)
    findings.push(
      finding({
        code: "abo.verification",
        status: "review",
        title: "Blood type verification required",
        detail:
          "Both blood types must be verified by two independently reported samples.",
        evidence: `Recipient ${p.verifiedTwoSamples}; donor ${d.verifiedTwoSamples}`,
        source: "OPTN 3.3.A–B (candidate), 2.7.A–C (donor)",
      })
    )
  if (aboCompatible(d.abo, p.abo)) {
    add(
      "compatible",
      "pass",
      p.abo === d.abo ? "Identical blood types" : "Compatible blood types",
      "Donor blood type is compatible with the recipient.",
      `${d.abo} → ${p.abo}`,
      TABLE_6_4
    )
    if (p.abo !== d.abo)
      add(
        "priority",
        "info",
        "Blood type priority",
        `OPTN blood type priority: ${aboPriority(d.abo, p.abo)}.`,
        `${d.abo} → ${p.abo}`,
        TABLE_6_4
      )
    return ruleResult("abo", findings)
  }
  const listingDate = ctx.patient.listing.listingDate
  const ageDate = listingDate === "" ? ctx.now : parseIsoDate(listingDate)
  const age =
    ageDate === null
      ? null
      : ageInYears(ctx.patient.identity.dateOfBirth, ageDate)
  const currentAge = ageInYears(ctx.patient.identity.dateOfBirth, ctx.now)
  if (!ctx.criteria.abo.allowPediatricIncompatible || !p.acceptsIncompatible) {
    add(
      "incompatible",
      "fail",
      "Incompatible blood types",
      "The intended pediatric incompatible pathway is disabled or the recipient has not opted in.",
      `${d.abo} → ${p.abo}`
    )
  } else if (age === null || currentAge === null) {
    findings.push(
      missingFinding(
        "abo.age",
        "Recipient age missing",
        "A valid birth date and listing date are required to establish pediatric eligibility.",
        source
      )
    )
  } else if (age >= 18) {
    add(
      "incompatible",
      "fail",
      "Incompatible blood types",
      "The recipient is not eligible for the pediatric incompatible pathway.",
      `${d.abo} → ${p.abo}; age ${age}`
    )
  } else if (currentAge < 1) {
    add(
      "infant",
      "review",
      "Intended incompatible transplant",
      "Opted-in infants younger than one year may be considered with any titer.",
      `${d.abo} → ${p.abo}; age <1 year`
    )
  } else {
    const titers =
      p.abo === "A"
        ? ([["anti-B", p.antiBTiter]] as const)
        : p.abo === "B"
          ? ([["anti-A", p.antiATiter]] as const)
          : ([
              ["anti-A", p.antiATiter],
              ["anti-B", p.antiBTiter],
            ] as const)
    if (p.titerLoweringTherapyWithin30Days)
      add(
        "therapy",
        "fail",
        "Recent titer-lowering therapy",
        "Titer-lowering therapy within 30 days prevents eligibility for this pathway."
      )
    for (const [name, value] of titers) {
      if (value === null)
        findings.push(
          missingFinding(
            `abo.${name}.missing`,
            `${name} titer missing`,
            "Record every required isohemagglutinin titer.",
            source
          )
        )
      else if (value > ctx.criteria.abo.maxTiterOneYearPlus)
        add(
          `${name}.high`,
          "fail",
          `${name} titer too high`,
          `Required titers must be at most 1:${ctx.criteria.abo.maxTiterOneYearPlus}.`,
          `1:${value}`
        )
    }
    const date = parseIsoDate(p.titerDate)
    const days =
      date === null ? NaN : (ctx.now.getTime() - date.getTime()) / 86400000
    if (!Number.isFinite(days) || days < 0 || days > 30)
      findings.push(
        missingFinding(
          "abo.titerDate",
          "Current titer date required",
          "Titers must be dated within the preceding 30 days.",
          source
        )
      )
    add(
      "pediatric",
      "review",
      "Intended incompatible transplant",
      "Pediatric incompatible transplantation requires specialist review.",
      `${d.abo} → ${p.abo}; current age ${currentAge}; age at eligibility ${age}`
    )
  }
  return ruleResult("abo", findings)
}
