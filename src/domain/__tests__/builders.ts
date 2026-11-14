import { emptyDonor, emptyPatient } from "../factories"
import type { Donor, Patient } from "../schema"

export type DeepPartial<T> =
  T extends ReadonlyArray<unknown>
    ? T
    : T extends object
      ? { [K in keyof T]?: DeepPartial<T[K]> }
      : T

function merge(base: object, overrides: object): Record<string, unknown> {
  const result = { ...base }
  const record = result as Record<string, unknown>
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      record[key] = merge(record[key] as object, value)
    } else {
      record[key] = value
    }
  }
  return result
}

export function patient(overrides: DeepPartial<Patient> = {}): Patient {
  const base = emptyPatient(new Date("2026-11-14T00:00:00Z"))
  Object.assign(base.identity, {
    mrn: "TEST-001",
    firstName: "Test",
    lastName: "Recipient",
    dateOfBirth: "1980-01-01",
  })
  return merge(base, overrides) as Patient
}

export function donor(overrides: DeepPartial<Donor> = {}): Donor {
  const base = emptyDonor(new Date("2026-11-14T00:00:00Z"))
  Object.assign(base.identity, { donorId: "DONOR-001", ageYears: 35 })
  return merge(base, overrides) as Donor
}
