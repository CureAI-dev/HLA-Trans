import { ageInYears, donorPhm, effectivePvr, patientPhm } from "../calc"
import type { Finding, RuleResult } from "../schema"
import type { RuleContext } from "./context"
import { finding, missingFinding, ruleResult } from "./findings"

export function evaluateSize(ctx: RuleContext): RuleResult {
  const { patient, donor, criteria, now } = ctx
  const c = criteria.size
  const findings: Array<Finding> = []
  const source =
    "ISHLT donor heart selection (Copeland 2023); Kransdorf 2019; Tao 2023"
  const add = (
    code: string,
    status: Finding["status"],
    title: string,
    detail: string,
    evidence: string
  ) => {
    findings.push(
      finding({ code: `size.${code}`, status, title, detail, evidence, source })
    )
  }
  const missing = (code: string, title: string, detail: string) =>
    findings.push(missingFinding(`size.${code}`, title, detail, source))
  const pw = patient.body.weightKg
  const dw = donor.body.weightKg
  const weight = pw !== null && dw !== null && pw > 0 && dw > 0 ? dw / pw : null
  const recipientPhm = patientPhm(patient, now)
  const offeredPhm = donorPhm(donor)
  const phm =
    recipientPhm && offeredPhm ? offeredPhm.total / recipientPhm.total : null
  const phmEvidence =
    phm !== null && offeredPhm && recipientPhm
      ? `PHM ratio ${phm.toFixed(2)} (donor ${offeredPhm.total.toFixed(2)} g / recipient ${recipientPhm.total.toFixed(2)} g)`
      : ""
  const weightEvidence =
    weight !== null && dw !== null && pw !== null
      ? `Weight ratio ${weight.toFixed(2)} (donor ${dw.toFixed(2)} kg / recipient ${pw.toFixed(2)} kg)`
      : ""
  const femaleToMale =
    donor.identity.sex === "female" && patient.identity.sex === "male"
  const age = ageInYears(patient.identity.dateOfBirth, now)

  if (dw !== null) {
    const { minDonorWeightKg: min, maxDonorWeightKg: max } = patient.acceptance
    if ((min !== null && dw < min) || (max !== null && dw > max))
      add(
        "acceptance",
        "fail",
        "Donor weight outside candidate limits",
        "Donor weight must satisfy the recipient's configured acceptance range.",
        `Donor ${dw.toFixed(2)} kg; minimum ${min?.toFixed(2) ?? "unset"} kg; maximum ${max?.toFixed(2) ?? "unset"} kg`
      )
  }
  if (age === null) {
    missing(
      "age.missing",
      "Recipient age missing",
      "Record a valid birth date to select adult or pediatric size criteria."
    )
    return ruleResult("size", findings)
  }
  if (age < 18) {
    if (weight === null)
      missing(
        "weight.missing",
        "Size measurements missing",
        "Record donor and recipient weights for pediatric size assessment."
      )
    else
      add(
        "weight",
        weight < c.pediatricWeightRatioMin || weight > c.pediatricWeightRatioMax
          ? "fail"
          : "pass",
        "Pediatric weight match",
        `Acceptable weight ratio ${c.pediatricWeightRatioMin.toFixed(2)}–${c.pediatricWeightRatioMax.toFixed(2)}.`,
        weightEvidence
      )
    if (phm !== null)
      add(
        "phm",
        "info",
        "Extrapolated pediatric PHM",
        "PHM is extrapolated in children; weight ratio drives the size decision.",
        phmEvidence
      )
    return ruleResult("size", findings)
  }
  if (phm !== null) {
    const status =
      phm < c.phmRatioReviewMin
        ? "fail"
        : phm < c.phmRatioPassMin || phm > c.phmRatioReviewMax
          ? "review"
          : "pass"
    add(
      "phm",
      status,
      "Predicted heart mass match",
      `Pass range ${c.phmRatioPassMin.toFixed(2)}–${c.phmRatioReviewMax.toFixed(2)}; fail below ${c.phmRatioReviewMin.toFixed(2)}.`,
      phmEvidence
    )
    add(
      "weight",
      "info",
      "Weight comparison",
      "PHM drives the adult size assessment.",
      weightEvidence
    )
    add(
      "sex",
      "info",
      "Donor and recipient sex",
      femaleToMale
        ? "Female donor to male recipient."
        : "No female-to-male size flag.",
      `${donor.identity.sex} donor / ${patient.identity.sex} recipient`
    )
  } else if (weight !== null) {
    const status =
      weight < c.weightRatioReviewMin
        ? "fail"
        : weight < c.weightRatioPassMin ||
            (femaleToMale && weight < c.femaleToMaleWeightRatioMin)
          ? "review"
          : "pass"
    add(
      "weight",
      status,
      "Weight fallback match",
      "PHM cannot be computed; donor-to-recipient weight ratio is used.",
      weightEvidence
    )
  } else
    missing(
      "weight.missing",
      "Size measurements missing",
      "Record donor and recipient size measurements; neither PHM nor weight ratio can be calculated."
    )

  const pvr = effectivePvr(patient)
  if (pvr === null)
    missing(
      "pvr.missing",
      "Recipient PVR missing",
      patient.hemodynamics.vasodilatorChallengeDone
        ? "Record post-vasodilator challenge PVR."
        : "Record hemodynamics needed to derive PVR."
    )
  else if (pvr > c.pulmonaryHypertensionPvr) {
    if (phm === null)
      missing(
        "phm.pvr.missing",
        "PHM required for pulmonary hypertension",
        "Record the measurements needed to check the pulmonary hypertension PHM requirement."
      )
    else if (phm < c.phmRatioMinWithPulmonaryHypertension)
      add(
        "pvr",
        "review",
        "Pulmonary hypertension: larger donor advised",
        `PHM ratio should be at least ${c.phmRatioMinWithPulmonaryHypertension.toFixed(2)} when PVR exceeds ${c.pulmonaryHypertensionPvr.toFixed(2)} WU.`,
        `PVR ${pvr.toFixed(2)} WU; ${phmEvidence}`
      )
  }
  return ruleResult("size", findings)
}
