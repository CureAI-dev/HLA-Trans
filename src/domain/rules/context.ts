import type { Criteria, Donor, PairInputs, Patient } from "../schema"

export type RuleContext = {
  patient: Patient
  donor: Donor
  pair: PairInputs
  criteria: Criteria
  now: Date
}
