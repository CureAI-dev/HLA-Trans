import { Link } from "@tanstack/react-router"
import {
  Ban,
  CheckCircle2,
  Clock,
  History,
  Loader,
  XCircle,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { formatDuration, STATUS_LABEL, TRIGGER_LABEL } from "../run-labels"
import type { RunRow } from "@/domain/match-types"
import { EmptyState } from "@/components/app/empty-state"
import { Badge } from "@/components/ui/badge"

const fmt = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
})

const STATUS: Record<
  RunRow["status"],
  { icon: LucideIcon; variant: "secondary" | "destructive" | "outline" }
> = {
  succeeded: { icon: CheckCircle2, variant: "secondary" },
  failed: { icon: XCircle, variant: "destructive" },
  cancelled: { icon: Ban, variant: "outline" },
  running: { icon: Loader, variant: "outline" },
  queued: { icon: Clock, variant: "outline" },
}

function RunStatusBadge({ status }: { status: RunRow["status"] }) {
  const { icon: Icon, variant } = STATUS[status]
  return (
    <Badge variant={variant}>
      <Icon
        aria-hidden="true"
        className={status === "running" ? "animate-spin" : undefined}
      />
      {STATUS_LABEL[status]}
    </Badge>
  )
}

function runDuration(run: RunRow) {
  if (!run.startedAt || !run.finishedAt) return "—"
  return formatDuration(
    (Date.parse(run.finishedAt) - Date.parse(run.startedAt)) / 1000
  )
}

export function RunHistoryTable({ rows }: { rows: ReadonlyArray<RunRow> }) {
  if (!rows.length)
    return (
      <EmptyState
        icon={<History />}
        title="No runs yet."
        description="Saving a patient or donor starts a matching run."
      />
    )
  return (
    <div className="overflow-x-auto border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted text-xs text-muted-foreground uppercase">
          <tr>
            <th className="p-3 font-medium">Status</th>
            <th className="p-3 font-medium">Subject</th>
            <th className="p-3 font-medium">Trigger</th>
            <th className="p-3 font-medium">Criteria</th>
            <th className="p-3 font-medium">Results</th>
            <th className="p-3 font-medium">Duration</th>
            <th className="p-3 font-medium">Started by</th>
            <th className="p-3 font-medium">Finished</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((run) => (
            <tr key={run.id} className="border-t hover:bg-muted/50">
              <td className="p-3">
                <RunStatusBadge status={run.status} />
              </td>
              <td className="p-3">
                <Link
                  to="/matching/$runId"
                  params={{ runId: run.id }}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {run.subjectLabel}
                </Link>
                <span className="block text-xs text-muted-foreground">
                  {run.subjectKind === "donor" ? "Donor" : "Patient"}
                </span>
              </td>
              <td className="p-3">{TRIGGER_LABEL[run.trigger]}</td>
              <td className="p-3 tabular-nums">v{run.criteriaVersion}</td>
              <td className="p-3 whitespace-nowrap tabular-nums">
                <span title="Pass · Review · Fail">
                  {run.passCount} · {run.reviewCount} · {run.failCount}
                </span>
              </td>
              <td className="p-3 tabular-nums">{runDuration(run)}</td>
              <td className="p-3">{run.createdBy}</td>
              <td className="p-3 whitespace-nowrap">
                {run.finishedAt ? fmt.format(new Date(run.finishedAt)) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
