import { Link } from "@tanstack/react-router"
import type { MatchRow } from "@/domain/match-types"
import { StatusBadge } from "@/components/app/status"

/** Saved screening results for one donor run, in screening order (urgency, pediatric, ABO, days at status). */
export function ScreeningResults({
  donorId,
  rows,
}: {
  donorId: string
  rows: ReadonlyArray<MatchRow>
}) {
  return (
    <section className="space-y-4">
      <p role="note" className="border p-4">
        Screening order, not OPTN allocation. Distance circles are not applied.
        Logistics are not assessed until pair inputs are entered.
      </p>
      <p className="text-sm text-muted-foreground">
        Screening uses the criteria of the match run and default pair inputs.
        Missing transport and procedure times produce REVIEW; enter pair inputs
        in Check a pair to assess logistics.
      </p>
      {rows.length === 0 ? (
        <p>
          No screening results for this donor yet. Results appear when its
          match run finishes.{" "}
          <Link className="underline" to="/patients/new">
            Add a patient
          </Link>{" "}
          or activate an existing candidate to include them.
        </p>
      ) : (
        <div className="overflow-x-auto border">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Candidate screening results</caption>
            <thead className="bg-muted">
              <tr>
                {[
                  "Rank",
                  "Patient",
                  "Overall",
                  "Blockers",
                  "Missing inputs",
                  "Criteria",
                  "Action",
                ].map((h) => (
                  <th key={h} scope="col" className="p-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id} className="border-t">
                  <td className="p-3 tabular-nums">{index + 1}</td>
                  <td className="p-3">
                    <Link
                      className="underline"
                      to="/patients/$patientId"
                      params={{ patientId: row.patientId }}
                    >
                      {row.patientName}
                    </Link>
                  </td>
                  <td className="p-3">
                    <StatusBadge status={row.overall} />
                    {row.outOfDate && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Out of date
                      </p>
                    )}
                  </td>
                  <td className="p-3 tabular-nums">{row.blockerCount}</td>
                  <td className="p-3 tabular-nums">{row.missingCount}</td>
                  <td className="p-3">v{row.criteriaVersion}</td>
                  <td className="p-3">
                    <Link
                      className="mr-3 underline"
                      to="/matches/$matchId"
                      params={{ matchId: row.id }}
                    >
                      View result
                    </Link>
                    <Link
                      className="underline"
                      to="/matches/check"
                      search={{ patientId: row.patientId, donorId }}
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
