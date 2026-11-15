import { Link } from "@tanstack/react-router"
import type { Donor } from "@/domain/schema"
import type { ScreenRow } from "@/domain/engine"
import { labelOf, URGENCY_STATUS } from "@/domain/options"
import { ageInYears } from "@/domain/calc"
import { parseIsoDate } from "@/domain/dates"
import { StatusBadge } from "@/components/app/status"

function hasKnownEligibilityAge(row: ScreenRow, now: Date): boolean {
  const listingDate = row.patient.listing.listingDate
  const on = listingDate === "" ? now : parseIsoDate(listingDate)
  return (
    on !== null && ageInYears(row.patient.identity.dateOfBirth, on) !== null
  )
}

export function ScreeningTable({
  donor,
  rows,
  now = new Date(),
}: {
  donor: Donor
  rows: ReadonlyArray<ScreenRow>
  now?: Date
}) {
  return (
    <section className="space-y-4">
      <p role="note" className="border p-4">
        Screening order, not OPTN allocation. Distance circles are not applied.
        Logistics are not assessed until pair inputs are entered.
      </p>
      <p className="text-sm text-muted-foreground">
        Screening uses the latest criteria and default pair inputs. Missing
        transport and procedure times produce REVIEW; enter pair inputs in Check
        a pair to assess logistics.
      </p>
      {donor.identity.ageYears !== null && donor.identity.ageYears < 18 && (
        <p>
          Pediatric candidates are ranked first within each urgency level (OPTN
          Table 6-8).
        </p>
      )}
      {rows.length === 0 ? (
        <p>
          No active candidates to screen.{" "}
          <Link className="underline" to="/patients/new">
            Add a patient
          </Link>{" "}
          or activate an existing candidate.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Candidate screening results</caption>
            <thead>
              <tr>
                {[
                  "Rank",
                  "Patient",
                  "Urgency",
                  "Pediatric",
                  "ABO priority",
                  "Days at status",
                  "Overall",
                  "Per-rule status",
                  "Action",
                ].map((h) => (
                  <th key={h} className="border-b p-3 text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.patient.id}>
                  <td className="p-3">{index + 1}</td>
                  <td className="p-3">
                    <Link
                      className="underline"
                      to="/patients/$patientId"
                      params={{ patientId: row.patient.id }}
                    >
                      {row.patient.identity.firstName}{" "}
                      {row.patient.identity.lastName}
                    </Link>
                    <p className="text-xs">MRN {row.patient.identity.mrn}</p>
                  </td>
                  <td className="p-3">
                    {row.patient.listing.urgencyStatus
                      ? labelOf(
                          URGENCY_STATUS,
                          row.patient.listing.urgencyStatus
                        )
                      : "Not recorded"}
                  </td>
                  <td className="p-3">
                    {!hasKnownEligibilityAge(row, now) ? (
                      "Unknown"
                    ) : row.isPediatricCandidate ? (
                      <span className="border px-2 py-1">Pediatric</span>
                    ) : (
                      "No"
                    )}
                  </td>
                  <td className="p-3">
                    {donor.blood.abo === null || row.patient.blood.abo === null
                      ? "Unknown (ABO not recorded)"
                      : row.aboPriority}
                  </td>
                  <td className="p-3 tabular-nums">
                    {row.daysAtStatus ?? "Not recorded"}
                    {row.daysAtStatusFromListing && (
                      <p className="text-xs">from listing date</p>
                    )}
                  </td>
                  <td className="p-3">
                    <StatusBadge status={row.result.overall} />
                  </td>
                  <td className="p-3">
                    <ul className="space-y-2">
                      {row.result.rules.map((rule) => (
                        <li key={rule.rule} className="flex items-center gap-2">
                          <span>
                            {
                              {
                                abo: "Blood type",
                                size: "Size",
                                immunology: "HLA and antibodies",
                                infection: "Infection",
                                donorHeart: "Donor heart",
                                logistics: "Logistics",
                              }[rule.rule]
                            }
                          </span>
                          <StatusBadge status={rule.status} />
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="p-3">
                    <Link
                      className="underline"
                      to="/matches/check"
                      search={{ patientId: row.patient.id, donorId: donor.id }}
                    >
                      Check this pair
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
