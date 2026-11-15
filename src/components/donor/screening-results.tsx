import { Link } from "@tanstack/react-router"
import { Users } from "lucide-react"
import type { MatchRow } from "@/domain/match-types"
import { StatusBadge } from "@/components/app/status"
import { EmptyState } from "@/components/app/empty-state"
import { Badge } from "@/components/ui/badge"

/**
 * Saved screening results for one donor run, in screening order
 * (outcome, urgency, pediatric priority, ABO priority, days at status).
 * `rankOffset` continues the numbering across keyset pages.
 */
export function ScreeningResults({
  donorId,
  rows,
  rankOffset = 0,
  criteriaVersion,
  emptyText,
}: {
  donorId: string
  rows: ReadonlyArray<MatchRow>
  rankOffset?: number
  criteriaVersion?: number
  emptyText: string
}) {
  return (
    <section className="space-y-3" aria-label="Candidate screening results">
      <p role="note" className="border bg-muted/40 p-3 text-sm">
        Screening order, not OPTN allocation. Distance circles are not applied.
        Logistics are not assessed until pair inputs are entered.
        <span className="mt-1 block text-xs text-muted-foreground">
          Screening uses the criteria of the match run
          {criteriaVersion !== undefined && ` (v${criteriaVersion})`} and default
          pair inputs. Missing transport and procedure times produce REVIEW;
          enter pair inputs in Check a pair to assess logistics.
        </span>
      </p>
      {rows.length === 0 ? (
        <EmptyState icon={<Users />} title="No screening results" description={emptyText} />
      ) : (
        <div className="overflow-x-auto border">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Candidate screening results, in screening order</caption>
            <thead className="bg-muted text-xs text-muted-foreground uppercase">
              <tr>
                {["Rank", "Patient", "Result", "Blockers", "Missing", "Action"].map((h) => (
                  <th key={h} scope="col" className="p-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id} className="border-t hover:bg-muted/50">
                  <td className="p-3 tabular-nums">{rankOffset + index + 1}</td>
                  <td className="p-3">
                    <Link
                      className="hover:underline"
                      to="/patients/$patientId"
                      params={{ patientId: row.patientId }}
                    >
                      {row.patientName}
                    </Link>
                  </td>
                  <td className="p-3">
                    <Link
                      to="/matches/$matchId"
                      params={{ matchId: row.id }}
                      aria-label={`View result for ${row.patientName}`}
                      className="inline-flex items-center gap-2 focus-visible:outline-2"
                    >
                      <StatusBadge status={row.overall} />
                      {row.outOfDate && <Badge variant="outline">Out of date</Badge>}
                    </Link>
                  </td>
                  <td className="p-3 tabular-nums">{row.blockerCount}</td>
                  <td className="p-3 tabular-nums">{row.missingCount}</td>
                  <td className="p-3">
                    <Link
                      className="underline-offset-4 hover:underline"
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
