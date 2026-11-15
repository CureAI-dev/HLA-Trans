import { effectivePvr } from "./calc"
import { DEFAULT_CRITERIA } from "./criteria"
import { parseIsoDate } from "./dates"
import { DONOR_TESTS, MCS_DEVICE, labelOf } from "./options"
import type { Criteria, Donor, Patient } from "./schema"

export type RiskFlag = {
  id: string
  severity: "fail" | "review" | "info"
  title: string
  detail: string
  /** Form section id where the underlying data is edited. */
  section: string
}

const DAY_MS = 86_400_000

/**
 * Donor facts that need a clinician's eye. Uses the same thresholds as the
 * engine (active criteria). Not a verdict: the match result decides nothing.
 */
export function donorRiskFlags(d: Donor, c: Criteria): RiskFlag[] {
  const flags: RiskFlag[] = []
  const lvef = d.echo.repeatLvef ?? d.echo.lvef
  if (lvef === null)
    flags.push({ id: "lvef.missing", severity: "review", title: "LVEF not recorded", detail: "Echocardiography is required for donor heart function review.", section: "echo" })
  else if (lvef < c.donor.lvefReviewMin)
    flags.push({ id: "lvef.fail", severity: "fail", title: `LVEF ${lvef}%`, detail: `Below ${c.donor.lvefReviewMin}% (active criteria).`, section: "echo" })
  else if (lvef < c.donor.lvefPassMin)
    flags.push({ id: "lvef.review", severity: "review", title: `LVEF ${lvef}%`, detail: `Between ${c.donor.lvefReviewMin}% and ${c.donor.lvefPassMin}%.`, section: "echo" })
  if (d.death.cardiacArrest === "yes")
    flags.push({
      id: "arrest",
      severity: d.death.cprMinutes === null || d.death.cprMinutes > c.donor.cprMinutesReview ? "review" : "info",
      title: "Cardiac arrest",
      detail: d.death.cprMinutes === null ? "CPR duration not recorded." : `CPR ${d.death.cprMinutes} min.`,
      section: "death",
    })
  if (d.death.carbonMonoxidePoisoning)
    flags.push({ id: "co", severity: "review", title: "Carbon monoxide poisoning", detail: d.death.carboxyhemoglobinPct === null ? "COHb not recorded." : `COHb ${d.death.carboxyhemoglobinPct}%.`, section: "death" })
  if (d.history.cocaine === "yes")
    flags.push({ id: "cocaine", severity: "review", title: "Cocaine use", detail: "Assess for LVH and coronary disease.", section: "history" })
  if (d.history.amphetamines === "yes")
    flags.push({ id: "amphetamines", severity: "review", title: "Amphetamine use", detail: "Assess LV function and wall thickness.", section: "history" })
  if (d.history.knownCad === "yes")
    flags.push({ id: "cad", severity: "review", title: "Known coronary disease", detail: "Review angiography.", section: "coronary" })
  if (d.donation.type === "dcd")
    flags.push({ id: "dcd", severity: "info", title: "DCD donor", detail: "Check recovery method and warm ischemia times.", section: "donation" })
  if (d.history.phsRiskCriteria.length)
    flags.push({ id: "phs", severity: "info", title: `PHS increased-risk (${d.history.phsRiskCriteria.length})`, detail: "Requires informed consent and NAT testing.", section: "history" })
  // Same count as the engine: distinct agents, vasopressin excluded.
  const agents = new Set(d.hemodynamics.vasoactives.filter((v) => v.agent !== "vasopressin").map((v) => v.agent))
  if (agents.size >= c.donor.vasoactiveAgentsReviewMin)
    flags.push({ id: "vasoactives", severity: "review", title: `${agents.size} vasoactive agents`, detail: "High support requirement (vasopressin not counted).", section: "hemodynamics" })
  for (const { value: test } of DONOR_TESTS)
    if (d.infection.serology[test] === "positive")
      flags.push({ id: `serology.${test}`, severity: "review", title: `${labelOf(DONOR_TESTS, test)} positive`, detail: "Check candidate acceptance settings.", section: "infection" })
  return flags
}

/**
 * Candidate facts that need a clinician's eye. Pass the active criteria; the
 * default exists only so callers without a loaded version still get flags.
 */
export function patientRiskFlags(p: Patient, now: Date, c: Criteria = DEFAULT_CRITERIA): RiskFlag[] {
  const flags: RiskFlag[] = []
  if (p.support.device !== "none")
    flags.push({ id: "mcs", severity: "info", title: labelOf(MCS_DEVICE, p.support.device), detail: "Mechanical circulatory support: plan for explant and longer implant time.", section: "support" })
  const cpra = p.sensitization.cpra
  if (cpra === null)
    flags.push({ id: "cpra.missing", severity: "review", title: "cPRA not recorded", detail: "Sensitization cannot be assessed.", section: "sensitization" })
  else if (cpra > c.immunology.cpraSensitizedMin)
    flags.push({ id: "cpra.high", severity: "review", title: `cPRA ${cpra}%`, detail: `Sensitized: above ${c.immunology.cpraSensitizedMin}% (active criteria).`, section: "sensitization" })
  if (p.sensitization.unacceptableAntigens.length)
    flags.push({
      id: "unacceptable",
      severity: "info",
      title: `${p.sensitization.unacceptableAntigens.length} unacceptable antigen${p.sensitization.unacceptableAntigens.length === 1 ? "" : "s"}`,
      detail: p.sensitization.unacceptableAntigens.join(", "),
      section: "sensitization",
    })
  const pvr = effectivePvr(p)
  if (pvr === null)
    flags.push({ id: "pvr.missing", severity: "review", title: "PVR not available", detail: "Record hemodynamics needed to derive PVR.", section: "hemodynamics" })
  else if (pvr > c.size.pulmonaryHypertensionPvr)
    flags.push({ id: "pvr.high", severity: "review", title: `PVR ${pvr.toFixed(1)} WU`, detail: `Above ${c.size.pulmonaryHypertensionPvr} WU: a larger donor is advised.`, section: "hemodynamics" })
  if (p.blood.abo === null)
    flags.push({ id: "abo.missing", severity: "review", title: "Blood type not recorded", detail: "ABO is required for every match.", section: "blood" })
  else if (!p.blood.verifiedTwoSamples)
    flags.push({ id: "abo.unverified", severity: "review", title: "Blood type not verified", detail: "Verify on two independently reported samples.", section: "blood" })
  const expires = parseIsoDate(p.listing.statusExpiresOn)
  if (expires !== null) {
    const days = Math.ceil((expires.getTime() - now.getTime()) / DAY_MS)
    if (days < 0)
      flags.push({ id: "status.expired", severity: "review", title: "Listing status expired", detail: `Expired on ${p.listing.statusExpiresOn}.`, section: "listing" })
    else if (days <= 7)
      flags.push({ id: "status.expiring", severity: "review", title: days === 0 ? "Listing status expires today" : `Listing status expires in ${days} day${days === 1 ? "" : "s"}`, detail: `Expires on ${p.listing.statusExpiresOn}.`, section: "listing" })
  }
  return flags
}
