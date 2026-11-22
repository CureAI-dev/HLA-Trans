import { hasHistory } from "../options"
import { ageInYears } from "../calc"
import type { Finding, RuleResult } from "../schema"
import type { RuleContext } from "./context"
import { finding, missingFinding, ruleResult } from "./findings"

const SOURCE =
  "ISHLT donor heart selection guideline (Copeland 2023); center practice thresholds"

export function evaluateDonorHeart(ctx: RuleContext): RuleResult {
  const { donor: d, patient: p } = ctx
  const c = ctx.criteria.donor
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
        code: `donorHeart.${code}`,
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
        `donorHeart.${code}`,
        title,
        `${title} is not recorded; assess before accepting the donor heart.`,
        SOURCE
      )
    )
  }
  const tri = (
    code: string,
    title: string,
    value: string,
    positiveStatus: Finding["status"] = "review"
  ) => {
    if (value === "unknown") missing(code, title)
    else if (value === "yes")
      add(code, positiveStatus, title, `${title} requires assessment.`, value)
  }
  const age = d.identity.ageYears
  if (age === null) missing("age", "Donor age")
  else {
    const patientLimit = p.acceptance.maxDonorAge
    const status =
      (patientLimit !== null && age > patientLimit) ||
      (c.ageFailAbove !== null && age > c.ageFailAbove)
        ? "fail"
        : age >= c.ageReviewAbove
          ? "review"
          : "pass"
    add(
      "age",
      status,
      "Donor age",
      `Patient maximum: ${patientLimit ?? "none"}; review at ${c.ageReviewAbove} or older; fail above ${c.ageFailAbove ?? "no upper limit"}. CAD screening is needed from the review age.`,
      `${age} years`
    )
  }
  const ef = d.echo.repeatLvef ?? d.echo.lvef
  if (ef === null) missing("lvef", "LVEF")
  else
    add(
      "lvef",
      ef < c.lvefReviewMin ? "fail" : ef < c.lvefPassMin ? "review" : "pass",
      "Left ventricular function",
      `Repeat LVEF takes precedence. Pass at ${c.lvefPassMin}% or above; fail below ${c.lvefReviewMin}%.`,
      `${ef}%`
    )
  if (d.echo.repeatLvef !== null)
    add(
      "repeatLvef",
      "info",
      "Repeat LVEF used",
      "The follow-up assessment replaces the initial LVEF for rule checks.",
      `Initial ${d.echo.lvef ?? "not recorded"}%; repeat ${d.echo.repeatLvef}%`
    )
  const wall =
    d.echo.septumMm === null || d.echo.posteriorWallMm === null
      ? null
      : Math.max(d.echo.septumMm, d.echo.posteriorWallMm)
  if (d.echo.septumMm === null || d.echo.posteriorWallMm === null)
    missing("wallThickness", "Both LV wall thickness measurements")
  // Retain known adverse measurements even when the other wall is missing.
  const measuredWalls = [d.echo.septumMm, d.echo.posteriorWallMm].filter(
    (value): value is number => value !== null
  )
  const knownWall = measuredWalls.length ? Math.max(...measuredWalls) : null
  if (
    knownWall !== null &&
    (wall !== null || knownWall > c.wallThicknessPassMax)
  )
    add(
      "wallThicknessMeasured",
      knownWall > c.wallThicknessReviewMax
        ? "fail"
        : knownWall > c.wallThicknessPassMax
          ? "review"
          : "pass",
      "LV wall thickness",
      `Pass up to ${c.wallThicknessPassMax} mm; fail above ${c.wallThicknessReviewMax} mm.`,
      `Septum ${d.echo.septumMm ?? "missing"} mm; posterior wall ${d.echo.posteriorWallMm ?? "missing"} mm`
    )
  if (d.echo.wallMotion === "unknown") missing("wallMotion", "Wall motion")
  else if (d.echo.wallMotion !== "normal")
    add(
      "wallMotion",
      "review",
      "Abnormal wall motion",
      "Review regional or global wall motion abnormalities.",
      d.echo.wallMotion
    )
  if (d.echo.valveDisease === "unknown")
    missing("valveDisease", "Valve disease")
  else if (["moderate", "severe"].includes(d.echo.valveDisease))
    add(
      "valveDisease",
      c.moderateValveOutcome,
      "Valve disease",
      "Moderate or severe valve disease; configured center outcome applied.",
      d.echo.valveDisease
    )
  if (d.echo.rvFunction === "unknown") missing("rvFunction", "RV function")
  else if (["moderate", "severe"].includes(d.echo.rvFunction))
    add(
      "rvFunction",
      "review",
      "Reduced RV function",
      "Review moderate or severe RV dysfunction.",
      d.echo.rvFunction
    )
  tri(
    "congenitalAbnormality",
    "Congenital abnormality",
    d.echo.congenitalAbnormality
  )
  tri("coronaryAnomaly", "Coronary anomaly", d.coronary.coronaryAnomaly, "fail")
  if (d.ecg.lvhCriteria === "unknown") missing("ecgLvh", "ECG LVH assessment")
  else if (
    d.ecg.lvhCriteria === "yes" &&
    knownWall !== null &&
    knownWall > c.wallThicknessPassMax
  )
    add(
      "ecgLvh",
      "review",
      "ECG LVH with increased wall thickness",
      "Review ECG and echo together.",
      `${knownWall} mm; ECG LVH yes`
    )
  for (const [key, title] of [
    ["knownCad", "Known CAD"],
    ["priorMi", "Prior MI"],
    ["priorCardiacSurgery", "Prior cardiac surgery"],
  ] as const)
    tri(key, title, d.history[key])
  const screeningRisks = [
    d.history.cocaine,
    d.history.cigarettesOver20PackYears,
  ]
  for (const [key, title] of [
    ["cocaine", "Cocaine history"],
    ["diabetes", "Diabetes history"],
    ["cigarettesOver20PackYears", "Smoking over 20 pack-years"],
  ] as const) {
    if (d.history[key] === "unknown") missing(key, title)
  }
  const angioIndicated =
    (age !== null &&
      age > (d.identity.sex === "male" ? c.angioAgeMale : c.angioAgeFemale)) ||
    screeningRisks.includes("yes") ||
    hasHistory(d.history.diabetes) === true
  if (d.coronary.angiography === "not_done" && angioIndicated)
    missing("angiographyIndicated", "Coronary angiography indicated")
  if (d.coronary.angiography === "abnormal") {
    const vessels = d.coronary.vesselsOver50
    if (vessels === null)
      missing("coronaryVessels", "Number of diseased coronary vessels")
    if (d.coronary.leftMainDisease || (vessels !== null && vessels >= 2))
      add(
        "coronaryDisease",
        c.multivesselCadOutcome,
        "Left main or multivessel CAD",
        "Configured multivessel CAD outcome applied.",
        `Left main ${d.coronary.leftMainDisease}; vessels ${vessels ?? "missing"}`
      )
    else if (vessels !== null)
      add(
        "coronaryDisease",
        vessels === 1 ? c.singleVesselCadOutcome : "pass",
        "Coronary disease",
        "Configured single-vessel CAD outcome applied when one vessel is involved.",
        `${vessels} vessels >50%`
      )
  }
  for (const key of ["sodiumPeak", "sodiumLatest"] as const) {
    const value = d.labs[key]
    if (value === null)
      missing(key, key === "sodiumPeak" ? "Peak sodium" : "Latest sodium")
    else
      add(
        key,
        value < c.sodiumFailBelow || value >= c.sodiumFailAtOrAbove
          ? "fail"
          : value < c.sodiumReviewBelow || value > c.sodiumReviewAbove
            ? "review"
            : "pass",
        key === "sodiumPeak" ? "Peak sodium" : "Latest sodium",
        `Fail below ${c.sodiumFailBelow} or at/above ${c.sodiumFailAtOrAbove}; review outside ${c.sodiumReviewBelow} - ${c.sodiumReviewAbove}.`,
        `${value} mmol/L`
      )
  }
  const agents = new Set(
    d.hemodynamics.vasoactives
      .filter((v) => v.agent !== "vasopressin")
      .map((v) => v.agent)
  )
  if (agents.size >= c.vasoactiveAgentsReviewMin)
    add(
      "multipleVasoactives",
      "review",
      "Multiple vasoactive agents",
      `Review at ${c.vasoactiveAgentsReviewMin} agents; vasopressin excluded.`,
      [...agents].join(", ")
    )
  for (const [index, drug] of d.hemodynamics.vasoactives.entries()) {
    if (drug.dose === null)
      missing(`vasoactiveDose.${index}`, `${drug.agent} dose`)
    else if (
      (drug.agent === "norepinephrine" &&
        drug.dose > c.norepinephrineMaxAlone) ||
      (drug.agent === "dopamine" && drug.dose > c.dopamineReviewAbove)
    )
      add(
        `vasoactiveDose.${index}`,
        "review",
        "Vasoactive dose",
        `Norepinephrine threshold ${c.norepinephrineMaxAlone}; dopamine threshold ${c.dopamineReviewAbove}.`,
        `${drug.agent} ${drug.dose} mcg/kg/min`
      )
  }
  if (d.hemodynamics.ecmo !== "none")
    add(
      "ecmo",
      d.hemodynamics.ecmo === "va_ongoing" ? "fail" : "info",
      "ECMO support",
      "Ongoing VA-ECMO precludes routine donor heart use; VV or weaned VA support is informational.",
      d.hemodynamics.ecmo
    )
  if (d.death.cardiacArrest === "unknown")
    missing("cardiacArrest", "Cardiac arrest history")
  else if (d.death.cardiacArrest === "yes") {
    if (d.death.cprMinutes === null) missing("cprMinutes", "CPR duration")
    else if (
      d.death.cprMinutes > c.cprMinutesReview &&
      ef !== null &&
      ef < c.lvefPassMin
    )
      add(
        "cprMinutes",
        "review",
        "Prolonged CPR with reduced LVEF",
        `CPR above ${c.cprMinutesReview} minutes requires preserved LVEF (at least ${c.lvefPassMin}%).`,
        `${d.death.cprMinutes} minutes; LVEF ${ef}%`
      )
  }
  const troponin = d.labs.troponinIPeak
  if (troponin === null) missing("troponinI", "Peak troponin I")
  else if (troponin > c.troponinIReviewAbove)
    add(
      "troponinI",
      "review",
      "Elevated troponin I",
      `Above ${c.troponinIReviewAbove} ng/mL; consider angiography. Not a reason to decline alone.`,
      `${troponin} ng/mL`
    )
  if (d.death.carbonMonoxidePoisoning) {
    const co = d.death.carboxyhemoglobinPct
    if (co === null) missing("coHb", "Carboxyhemoglobin")
    if (d.ecg.ischemicChanges === "unknown")
      missing("coIschemicEcg", "Ischemic ECG assessment in CO poisoning")
    if (
      (co !== null && co > c.coHbFailAbove) ||
      (troponin !== null && troponin >= c.coTroponinFailAtOrAbove) ||
      d.ecg.ischemicChanges === "yes" ||
      (ef !== null && ef < c.lvefPassMin)
    )
      add(
        "coPoisoning",
        "fail",
        "CO poisoning with cardiac risk",
        `Avoid above COHb ${c.coHbFailAbove}%, troponin at least ${c.coTroponinFailAtOrAbove} ng/mL, ischemic ECG, or LVEF below ${c.lvefPassMin}%.`,
        `COHb ${co ?? "missing"}%; troponin I ${troponin ?? "missing"} ng/mL; ECG ${d.ecg.ischemicChanges}; LVEF ${ef ?? "missing"}%`
      )
  }
  if (d.history.malignancyRisk === "unknown")
    missing("malignancy", "Malignancy risk")
  else if (["high", "intermediate"].includes(d.history.malignancyRisk))
    add(
      "malignancy",
      d.history.malignancyRisk === "high" ? "fail" : "review",
      "Malignancy transmission risk",
      "High risk fails; intermediate risk requires specialist review.",
      d.history.malignancyRisk
    )
  if (
    d.history.cocaine === "yes" &&
    knownWall !== null &&
    knownWall > c.wallThicknessPassMax
  )
    add(
      "cocaineWallThickness",
      "review",
      "Cocaine history with increased wall thickness",
      "Review cocaine exposure and ventricular hypertrophy together.",
      `${knownWall} mm; cocaine yes`
    )
  if (d.death.unexplainedSuddenDeath)
    add(
      "unexplainedSuddenDeath",
      "review",
      "Unexplained sudden death",
      "Screen for HCM, long QT, Brugada syndrome, and coronary anomaly.",
      "Unexplained sudden death yes"
    )
  const recipientAge = ageInYears(p.identity.dateOfBirth, ctx.now)
  if (age !== null && age > 45) {
    if (recipientAge === null)
      missing("recipientAge", "Recipient age for older-donor counseling")
    else if (recipientAge < 45)
      add(
        "olderDonorYoungerRecipient",
        "info",
        "Older donor and younger recipient",
        "Older donors may suit older or highly sensitized recipients.",
        `Donor ${age} years; recipient ${recipientAge} years`
      )
  }
  return ruleResult("donorHeart", findings)
}
