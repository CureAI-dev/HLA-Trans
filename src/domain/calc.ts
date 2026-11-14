import type { Sex } from "./options"
import { MCS_REQUIRES_EXPLANT } from "./options"
import type { Criteria, Donor, PairInputs, Patient } from "./schema"

/**
 * Derived clinical values. Every function returns null when an input is
 * missing or outside the formula's domain. Nothing here guesses.
 */

const ok = (n: number | null | undefined): n is number =>
  typeof n === "number" && Number.isFinite(n)

export const round = (n: number, digits = 2): number => {
  const f = 10 ** digits
  return Math.round(n * f) / f
}

/* ---------------------------- Age -------------------------------- */

/** Whole years between an ISO date of birth and `on` (default now). */
export function ageInYears(dateOfBirth: string, on: Date = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return null
  const [y, m, d] = dateOfBirth.split("-").map(Number) as [number, number, number]
  const dob = new Date(Date.UTC(y, m - 1, d))
  if (Number.isNaN(dob.getTime()) || dob.getTime() > on.getTime()) return null
  let age = on.getUTCFullYear() - y
  const beforeBirthday =
    on.getUTCMonth() < m - 1 || (on.getUTCMonth() === m - 1 && on.getUTCDate() < d)
  if (beforeBirthday) age -= 1
  return age
}

/** Fractional years (for PHM's age term, which must be > 0). */
export function ageInYearsExact(dateOfBirth: string, on: Date = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return null
  const dob = new Date(`${dateOfBirth}T00:00:00Z`)
  const ms = on.getTime() - dob.getTime()
  if (Number.isNaN(ms) || ms <= 0) return null
  return ms / (365.2425 * 24 * 3600 * 1000)
}

/* ------------------------ Anthropometrics ------------------------ */

/** BMI = kg / m². */
export function bmi(heightCm: number | null, weightKg: number | null): number | null {
  if (!ok(heightCm) || !ok(weightKg) || heightCm <= 0 || weightKg <= 0) return null
  const m = heightCm / 100
  return weightKg / (m * m)
}

export function bmiCategory(value: number | null): string | null {
  if (!ok(value)) return null
  if (value < 18.5) return "Underweight"
  if (value < 25) return "Normal"
  if (value < 30) return "Overweight"
  if (value < 35) return "Obesity class I"
  if (value < 40) return "Obesity class II"
  return "Obesity class III"
}

/** Mosteller 1987: √(cm × kg / 3600). */
export function bsaMosteller(heightCm: number | null, weightKg: number | null): number | null {
  if (!ok(heightCm) || !ok(weightKg) || heightCm <= 0 || weightKg <= 0) return null
  return Math.sqrt((heightCm * weightKg) / 3600)
}

/** DuBois 1916: 0.007184 × kg^0.425 × cm^0.725. */
export function bsaDuBois(heightCm: number | null, weightKg: number | null): number | null {
  if (!ok(heightCm) || !ok(weightKg) || heightCm <= 0 || weightKg <= 0) return null
  return 0.007184 * weightKg ** 0.425 * heightCm ** 0.725
}

export type PhmBreakdown = { lv: number; rv: number; total: number }

/**
 * Predicted heart mass (Reed et al., JACC HF 2014; MESA-derived).
 *   LV (g) = a × H(m)^0.54 × W(kg)^0.61            a = 8.25 male, 6.82 female
 *   RV (g) = a × age^-0.32 × H(m)^1.135 × W^0.315   a = 11.25 male, 10.59 female
 * Validated in adults; extrapolation for age < 18.
 */
export function predictedHeartMass(input: {
  sex: Sex
  ageYears: number | null
  heightCm: number | null
  weightKg: number | null
}): PhmBreakdown | null {
  const { sex, ageYears, heightCm, weightKg } = input
  if (!ok(ageYears) || !ok(heightCm) || !ok(weightKg)) return null
  if (ageYears <= 0 || heightCm <= 0 || weightKg <= 0) return null
  const h = heightCm / 100
  const male = sex === "male"
  const lv = (male ? 8.25 : 6.82) * h ** 0.54 * weightKg ** 0.61
  const rv = (male ? 11.25 : 10.59) * ageYears ** -0.32 * h ** 1.135 * weightKg ** 0.315
  return { lv, rv, total: lv + rv }
}

/* -------------------------- Hemodynamics ------------------------- */

export type DerivedHemodynamics = {
  /** Cardiac index used (measured or CO/BSA). */
  cardiacIndex: number | null
  cardiacIndexDerived: boolean
  /** TPG = mPAP − PCWP (mmHg). */
  tpg: number | null
  /** DPG = PA diastolic − PCWP (mmHg). */
  dpg: number | null
  /** PVR = TPG / CO (Wood units). */
  pvr: number | null
  /** PVRI = TPG / CI (WU·m²). */
  pvri: number | null
  /** mPAP measured, or estimated as dia + (sys − dia)/3. */
  paMean: number | null
  paMeanDerived: boolean
}

export function patientHemodynamics(p: Patient): DerivedHemodynamics {
  const h = p.hemodynamics
  const bsa = bsaMosteller(p.body.heightCm, p.body.weightKg)

  let paMean = h.paMean
  let paMeanDerived = false
  if (!ok(paMean) && ok(h.paSystolic) && ok(h.paDiastolic)) {
    paMean = h.paDiastolic + (h.paSystolic - h.paDiastolic) / 3
    paMeanDerived = true
  }

  let ci = h.cardiacIndex
  let ciDerived = false
  if (!ok(ci) && ok(h.cardiacOutput) && ok(bsa) && bsa > 0) {
    ci = h.cardiacOutput / bsa
    ciDerived = true
  }

  const tpg = ok(paMean) && ok(h.pcwp) ? paMean - h.pcwp : null
  const dpg = ok(h.paDiastolic) && ok(h.pcwp) ? h.paDiastolic - h.pcwp : null
  const pvr = ok(tpg) && ok(h.cardiacOutput) && h.cardiacOutput > 0 ? tpg / h.cardiacOutput : null
  const pvri = ok(tpg) && ok(ci) && ci > 0 ? tpg / ci : null

  return {
    cardiacIndex: ok(ci) ? ci : null,
    cardiacIndexDerived: ciDerived,
    tpg,
    dpg,
    pvr,
    pvri,
    paMean: ok(paMean) ? paMean : null,
    paMeanDerived,
  }
}

/** PVR that should drive size decisions: post-challenge value if done. */
export function effectivePvr(p: Patient): number | null {
  if (p.hemodynamics.vasodilatorChallengeDone && ok(p.hemodynamics.pvrAfterChallenge)) {
    return p.hemodynamics.pvrAfterChallenge
  }
  return patientHemodynamics(p).pvr
}

/* --------------------------- Ischemia ---------------------------- */

export type IschemiaEstimate = {
  /** Total estimated cross-clamp → reperfusion, minutes. */
  totalMinutes: number
  /** Ischemic minutes excluding normothermic perfusion time. */
  coldMinutes: number
  parts: Array<{ label: string; minutes: number }>
  /** Inputs that were not recorded and were treated as "none" (rules flag these). */
  unknowns: Array<string>
}

export function estimateIschemia(
  pair: PairInputs,
  patient: Patient,
  criteria: Criteria["logistics"]
): IschemiaEstimate | null {
  const { procurementMinutes, transportMinutes, implantMinutes } = pair
  if (!ok(procurementMinutes) || !ok(transportMinutes) || !ok(implantMinutes)) return null

  const parts: IschemiaEstimate["parts"] = [
    { label: "Procurement and packaging", minutes: procurementMinutes },
    { label: "Transport", minutes: transportMinutes },
    { label: "Implant to reperfusion", minutes: implantMinutes },
  ]
  const unknowns: Array<string> = []
  const sternotomies = patient.history.priorSternotomies
  if (sternotomies === null) unknowns.push("Prior sternotomies not recorded")
  if (sternotomies !== null && sternotomies > 0) {
    parts.push({ label: "Redo sternotomy", minutes: criteria.redoSternotomyExtraMinutes })
  }
  if (MCS_REQUIRES_EXPLANT.includes(patient.support.device)) {
    parts.push({ label: "Device explant", minutes: criteria.deviceExplantExtraMinutes })
  }
  const totalMinutes = parts.reduce((sum, part) => sum + part.minutes, 0)
  const perfusion =
    pair.preservation === "ocs_normothermic" && ok(pair.perfusionMinutes)
      ? Math.min(pair.perfusionMinutes, totalMinutes)
      : 0
  return { totalMinutes, coldMinutes: totalMinutes - perfusion, parts, unknowns }
}

/* ------------------------- Convenience --------------------------- */

export function patientAge(p: Patient, on?: Date) {
  return ageInYears(p.identity.dateOfBirth, on)
}

export function patientPhm(p: Patient, on?: Date): PhmBreakdown | null {
  return predictedHeartMass({
    sex: p.identity.sex,
    ageYears: ageInYearsExact(p.identity.dateOfBirth, on),
    heightCm: p.body.heightCm,
    weightKg: p.body.weightKg,
  })
}

export function donorPhm(d: Donor): PhmBreakdown | null {
  return predictedHeartMass({
    sex: d.identity.sex,
    ageYears: d.identity.ageYears,
    heightCm: d.body.heightCm,
    weightKg: d.body.weightKg,
  })
}

export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60)
  const m = Math.round(total % 60)
  return h > 0 ? `${h} h ${m.toString().padStart(2, "0")} min` : `${m} min`
}
