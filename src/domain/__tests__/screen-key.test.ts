import { describe, expect, it } from "vitest"
import { DEFAULT_CRITERIA } from "../criteria"
import { isPediatricDonor, screenDonor, screenRow } from "../engine"
import { URGENCY_STATUS_VALUES, ABO_VALUES } from "../options"
import { donorScreenKey } from "../screen-key"
import { donor, patient } from "./builders"

const now = new Date("2026-11-14T12:00:00Z")

/** Deterministic pseudo-random cohort covering urgency, ABO, dates and pediatric ages. */
function cohort(n: number) {
  let seed = 7
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31
  return Array.from({ length: n }, (_, i) =>
    patient({
      id: `pat_${String(i).padStart(3, "0")}`,
      identity: { dateOfBirth: rnd() < 0.2 ? "2018-03-01" : "1975-06-15" },
      listing: {
        state: "active",
        urgencyStatus:
          rnd() < 0.1
            ? null
            : URGENCY_STATUS_VALUES[
                Math.floor(rnd() * URGENCY_STATUS_VALUES.length)
              ],
        statusDate:
          rnd() < 0.15
            ? ""
            : `2026-${String(1 + Math.floor(rnd() * 10)).padStart(2, "0")}-15`,
        listingDate: rnd() < 0.1 ? "" : "2025-12-01",
      },
      blood: {
        abo:
          rnd() < 0.05
            ? null
            : ABO_VALUES[Math.floor(rnd() * ABO_VALUES.length)],
      },
    })
  )
}

describe("donorScreenKey", () => {
  for (const age of [34, 12]) {
    it(`sorts byte-wise exactly like screenDonor (donor age ${age})`, () => {
      const d = donor({
        identity: { ageYears: age, state: "available" },
        blood: { abo: "O" },
      })
      const patients = cohort(120)
      const expected = screenDonor(d, patients, DEFAULT_CRITERIA, now).map(
        (r) => r.patient.id
      )
      const keyed = patients
        .map((p) => ({
          id: p.id,
          key: donorScreenKey(
            screenRow(d, p, DEFAULT_CRITERIA, now),
            isPediatricDonor(d)
          ),
        }))
        .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
        .map((r) => r.id)
      expect(keyed).toEqual(expected)
    })
  }
})
