import { DONOR_TESTS, DONOR_TESTS_ALWAYS_REQUIRED } from "../options"
import { parseIsoDate } from "../dates"
import type { Finding, Outcome, RuleResult } from "../schema"
import type { RuleContext } from "./context"
import { finding, missingFinding, ruleResult } from "./findings"

/** Infection screening follows spec 6.4; configurable outcomes never override missing data. */
export function evaluateInfection(ctx: RuleContext): RuleResult {
  const { donor, patient } = ctx
  const infection = donor.infection
  const tests = infection.serology
  const config = ctx.criteria.infection
  const findings: Array<Finding> = []
  const add = (
    code: string,
    status: Outcome | "info",
    title: string,
    detail: string,
    source = "Center practice"
  ) =>
    findings.push(
      finding({
        code: `infection.${code}`,
        status,
        title,
        detail,
        evidence: detail,
        source,
      })
    )
  const missing = (code: string, title: string, source = "OPTN 2.10") =>
    findings.push(
      missingFinding(
        `infection.missing.${code}`,
        title,
        "Required clinical information is not recorded.",
        source
      )
    )
  for (const { value, label } of DONOR_TESTS) {
    const required =
      DONOR_TESTS_ALWAYS_REQUIRED.includes(value) ||
      (value === "chagas" && donor.history.bornInChagasEndemicCountry === "yes")
    if (tests[value] === "not_done" && required)
      missing(value, `${label} not done`)
    if (tests[value] === "indeterminate")
      add(
        `indeterminate.${value}`,
        "review",
        `${label} indeterminate`,
        "Resolve indeterminate donor testing before acceptance.",
        "OPTN 2.10"
      )
  }
  // OPTN 2.10.6: WNV NAT for donors recovered 1 July–31 October. Referral date stands in for recovery date.
  const referral = parseIsoDate(donor.identity.referralDate)
  const referralMonth = referral === null ? null : referral.getUTCMonth()
  if (
    referralMonth !== null &&
    referralMonth >= 6 &&
    referralMonth <= 9 &&
    tests.wnv === "not_done"
  )
    findings.push(
      missingFinding(
        "infection.missing.wnv",
        "West Nile virus NAT not done",
        "Required for donors recovered between 1 July and 31 October (referral date used as the recovery date).",
        "OPTN 2.10.6"
      )
    )
  if (
    donor.history.bornInChagasEndemicCountry === "unknown" &&
    tests.chagas === "not_done"
  )
    missing(
      "chagasEndemicBirth",
      "Chagas screening indication unknown",
      "OPTN 2.10.5"
    )
  if (!infection.sampleDrawnWithin96h)
    add(
      "sampleTiming",
      "review",
      "Sample timing requires review",
      "Donor sample is not confirmed drawn within 96 hours.",
      "OPTN 2.10"
    )
  const positive = (key: keyof typeof tests) => tests[key] === "positive"
  if (
    (positive("hivAbAg") || positive("hivNat")) &&
    (patient.serology.hiv === "not_done" ||
      patient.serology.hiv === "indeterminate")
  )
    missing("recipient.hiv", "Recipient HIV status unresolved", "OPTN 15.7.A")
  if (positive("hivAbAg") || positive("hivNat"))
    add(
      "hiv",
      patient.serology.hiv === "positive" && patient.enrolledHivResearchProtocol
        ? "review"
        : config.hivDonorOutcome,
      "Donor HIV positive",
      "HIV-positive organ use requires an HIV-positive recipient enrolled in a research protocol.",
      "OPTN 15.7.A, 15.7.D (HOPE Act research protocol)"
    )
  if (positive("hcvNat"))
    add(
      "hcvNat",
      patient.acceptance.acceptHcvNat ? config.hcvNatOutcome : "fail",
      "HCV NAT positive",
      "DAA treatment and informed consent required.",
      "ISHLT cardiothoracic HCV consensus (Aslam 2020)"
    )
  if (positive("antiHcv") && tests.hcvNat === "negative")
    add(
      "hcvAbOnly",
      patient.acceptance.acceptHcvAb ? config.hcvAbOnlyOutcome : "fail",
      "Anti-HCV positive, NAT negative",
      "Recipient acceptance and NAT surveillance required.",
      "ISHLT cardiothoracic HCV consensus (Aslam 2020)"
    )
  if (positive("hbsAg") || positive("hbvNat"))
    add(
      "hbv",
      patient.acceptance.acceptHbvNat ? config.hbsAgOrHbvNatOutcome : "fail",
      "HBsAg or HBV NAT positive",
      "HBV prophylaxis and consent required.",
      "AST HBV donor consensus (Huprikar 2015)"
    )
  if (
    positive("antiHbc") &&
    tests.hbsAg === "negative" &&
    tests.hbvNat === "negative"
  )
    add(
      "antiHbcOnly",
      patient.acceptance.acceptAntiHbc ? config.antiHbcOnlyOutcome : "fail",
      "Isolated anti-HBc positive",
      "Recipient acceptance and surveillance required.",
      "AST HBV donor consensus (Huprikar 2015)"
    )
  for (const [key, label, outcome, riskSource] of [
    ["cmvIgG", "CMV", config.cmvHighRiskOutcome, "CMV consensus (Kotton 2025)"],
    [
      "ebvIgG",
      "EBV",
      config.ebvHighRiskOutcome,
      "AST EBV/PTLD guideline (Allen 2019)",
    ],
    [
      "toxoIgG",
      "Toxoplasma",
      config.toxoHighRiskOutcome,
      "Heart D+/R- transmission 50-75% without prophylaxis",
    ],
  ] as const) {
    const recipient = patient.serology[key]
    if (recipient === "not_done")
      missing(
        `recipient.${key}`,
        `Recipient ${label} not done`,
        "Recipient pre-transplant screening"
      )
    else if (recipient === "indeterminate")
      add(
        `recipient.${key}`,
        "review",
        `Recipient ${label} indeterminate`,
        "Resolve recipient serostatus to determine mismatch risk.",
        riskSource
      )
    if (positive(key) && recipient === "negative")
      add(
        `${key}.highRisk`,
        outcome,
        `${label} D+/R-negative`,
        label === "EBV"
          ? "PTLD risk: viral load surveillance required."
          : "High risk mismatch: prophylaxis required.",
        riskSource
      )
    else if (
      key === "cmvIgG" &&
      (recipient === "positive" || recipient === "negative") &&
      (tests[key] === "positive" || tests[key] === "negative")
    )
      add(
        "cmv.risk",
        "info",
        "CMV risk",
        recipient === "positive"
          ? "Intermediate risk: recipient seropositive."
          : "Low risk: donor and recipient seronegative.",
        riskSource
      )
  }
  for (const [key, outcome, positiveSource] of [
    [
      "chagas",
      config.chagasOutcome,
      "Chagas in Transplant Working Group (Chin-Hong 2011)",
    ],
    [
      "strongyloides",
      config.strongyloidesOutcome,
      "AST parasites guideline (La Hoz 2019)",
    ],
    ["syphilis", config.syphilisOutcome, "Center practice"],
    ["wnv", config.wnvOutcome, "ISHLT donor heart selection (Copeland 2023)"],
  ] as const)
    if (positive(key))
      add(
        key,
        outcome,
        `Donor ${key} positive`,
        key === "strongyloides"
          ? "Treat recipient with ivermectin."
          : "Transplant infectious disease review required.",
        positiveSource
      )
  if (positive("sarsCov2"))
    add(
      "sarsCov2",
      "review",
      "SARS-CoV-2 positive",
      "Assess active infection with transplant infectious disease specialists."
    )
  if (infection.bloodCulturePositive === "unknown")
    missing("bloodCulture", "Blood culture status unknown", "OPTN 2.10.1")
  else if (infection.bloodCulturePositive === "yes")
    add(
      "bacteremia",
      config.bacteremiaOutcome,
      "Positive blood culture",
      infection.bloodCultureTargetedTherapy
        ? "Targeted antimicrobial therapy recorded."
        : "Targeted antimicrobial therapy required.",
      "ISHLT donor heart selection (Copeland 2023)"
    )
  if (infection.cnsInfection === "unknown")
    missing("cnsInfection", "CNS infection status unknown")
  else if (infection.cnsInfection !== "none")
    add(
      "cns",
      infection.cnsInfection === "viral_fungal_amebic"
        ? "fail"
        : infection.cnsInfection === "bacterial_untreated"
          ? "review"
          : "info",
      "CNS infection",
      infection.cnsInfection
    )
  if (donor.history.phsRiskCriteria.length)
    add(
      "phs",
      patient.acceptance.acceptPhsRisk ? config.phsRiskOutcome : "fail",
      "PHS risk criteria present",
      `Disclosure required: ${donor.history.phsRiskCriteria.join(", ")}.`,
      "PHS 2020"
    )
  if (!findings.length)
    add(
      "negative",
      "pass",
      "Infection screen negative",
      "Required donor tests complete; no infection risk identified.",
      "OPTN 2.10"
    )
  return ruleResult("infection", findings)
}
