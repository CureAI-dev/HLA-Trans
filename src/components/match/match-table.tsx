import { Link } from "@tanstack/react-router"
import { History } from "lucide-react"
import type { MatchRow } from "@/domain/match-types"
import { StatusBadge } from "@/components/app/status"
import { EmptyState } from "@/components/app/empty-state"
import { Badge } from "@/components/ui/badge"

const fmt = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
})

const VERDICT: Record<NonNullable<MatchRow["decision"]>, string> = {
  accept: "Accepted",
  decline: "Declined",
  defer: "Deferred",
}

/** Shared by Match results, run detail and the detail-page Matches tabs. */
export function MatchTable({
  rows,
  showPatient = true,
  showDonor = true,
  emptyText,
}: {
  rows: ReadonlyArray<MatchRow>
  showPatient?: boolean
  showDonor?: boolean
  emptyText: string
}) {
  if (!rows.length)
    return (
      <EmptyState
        icon={<History />}
        title="No match results"
        description={emptyText}
      />
    )
  return (
    <div className="overflow-x-auto border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted text-xs text-muted-foreground uppercase">
          <tr>
            <th className="p-3 font-medium">Result</th>
            {showPatient && <th className="p-3 font-medium">Patient</th>}
            {showDonor && <th className="p-3 font-medium">Donor</th>}
            <th className="p-3 font-medium">Blockers</th>
            <th className="p-3 font-medium">Missing</th>
            <th className="p-3 font-medium">Source</th>
            <th className="p-3 font-medium">Decision</th>
            <th className="p-3 font-medium">Created</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t hover:bg-muted/50">
              <td className="p-3">
                <Link
                  to="/matches/$matchId"
                  params={{ matchId: r.id }}
                  className="inline-flex items-center gap-2 focus-visible:outline-2"
                >
                  <StatusBadge status={r.overall} />
                  {r.outOfDate && <Badge variant="outline">Out of date</Badge>}
                </Link>
              </td>
              {showPatient && (
                <td className="p-3">
                  <Link
                    to="/patients/$patientId"
                    params={{ patientId: r.patientId }}
                    className="hover:underline"
                  >
                    {r.patientName}
                  </Link>
                </td>
              )}
              {showDonor && (
                <td className="p-3 font-mono">
                  <Link
                    to="/donors/$donorId"
                    params={{ donorId: r.donorId }}
                    className="hover:underline"
                  >
                    {r.donorCode}
                  </Link>
                </td>
              )}
              <td className="p-3 tabular-nums">{r.blockerCount}</td>
              <td className="p-3 tabular-nums">{r.missingCount}</td>
              <td className="p-3">
                {r.source === "checked" ? "Checked pair" : "Screening"}
              </td>
              <td className="p-3">
                {r.decision
                  ? VERDICT[r.decision]
                  : r.source === "checked"
                    ? "Pending"
                    : "—"}
              </td>
              <td className="p-3 whitespace-nowrap text-muted-foreground">
                <time dateTime={r.createdAt} suppressHydrationWarning>
                  {fmt.format(new Date(r.createdAt))}
                </time>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
