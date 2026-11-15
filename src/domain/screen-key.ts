import type { ScreenRow } from "./engine"
import { URGENCY_RANK } from "./options"
import type { Outcome } from "./schema"

const OUTCOME: Record<Outcome, number> = { pass: 0, review: 1, fail: 2 }
const BLOOD: Record<ScreenRow["aboPriority"], number> = {
  primary: 0,
  secondary: 1,
  incompatible: 2,
}
const DAYS_MAX = 9_999_998
const pad = (n: number, width: number) => String(n).padStart(width, "0")

/**
 * Fixed-width string whose byte order (COLLATE "C") equals screenDonor's comparator:
 * outcome, urgency (unrecorded last), pediatric-first for pediatric donors, ABO priority,
 * days at status descending (unknown last), then patient id. Not OPTN allocation.
 */
export function donorScreenKey(
  row: ScreenRow,
  pediatricDonor: boolean
): string {
  const status = row.patient.listing.urgencyStatus
  const urgency = status === null ? 99 : URGENCY_RANK[status]
  const pediatric = pediatricDonor ? (row.isPediatricCandidate ? 0 : 1) : 0
  const days =
    row.daysAtStatus === null
      ? DAYS_MAX + 1
      : DAYS_MAX - Math.min(row.daysAtStatus, DAYS_MAX)
  return `${OUTCOME[row.result.overall]}${pad(urgency, 2)}${pediatric}${BLOOD[row.aboPriority]}${pad(days, 7)}|${row.patient.id}`
}

/** Patient-subject runs: best outcome first, then donor id. */
export function patientScreenKey(overall: Outcome, donorId: string): string {
  return `${OUTCOME[overall]}|${donorId}`
}
