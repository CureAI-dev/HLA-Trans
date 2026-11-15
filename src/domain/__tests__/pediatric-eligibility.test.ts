import { describe, expect, it } from "vitest"
import { DEFAULT_CRITERIA } from "../criteria"
import { emptyDonor, emptyPatient } from "../factories"
import { isPediatricCandidate, screenDonor } from "../engine"

// Ported from the removed ScreeningTable presentation test: eligibility is the
// candidate's age at listing (or today when unlisted); unknown ages are never pediatric.
const now = new Date("2026-11-14T00:00:00Z")

describe("pediatric candidate eligibility", () => {
  it.each([
    ["missing birth date", "", "2026-01-01", false],
    ["future birth date", "2099-01-01", "", false],
    ["birth after listing", "2026-02-01", "2026-01-01", false],
    ["invalid listing date", "2000-01-01", "2026-02-30", false],
    ["pediatric at listing, adult now", "2008-06-01", "2026-01-01", true],
    ["adult at listing", "2000-01-01", "2026-01-01", false],
    ["pediatric without listing date", "2020-01-01", "", true],
    ["adult without listing date", "2000-01-01", "", false],
  ])("%s", (_case, birthDate, listingDate, expected) => {
    const patient = emptyPatient()
    patient.listing.state = "active"
    patient.identity.dateOfBirth = birthDate
    patient.listing.listingDate = listingDate
    expect(isPediatricCandidate(patient, now)).toBe(expected)
    const [row] = screenDonor(emptyDonor(), [patient], DEFAULT_CRITERIA, now)
    expect(row.isPediatricCandidate).toBe(expected)
  })

  it("uses the listing date for status duration when the status date is missing", () => {
    const patient = emptyPatient()
    patient.listing.state = "active"
    patient.listing.listingDate = "2026-01-01"
    const [row] = screenDonor(emptyDonor(), [patient], DEFAULT_CRITERIA, now)
    expect(row.daysAtStatusFromListing).toBe(true)
  })
})
