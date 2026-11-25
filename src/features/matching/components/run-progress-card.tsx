import { Link } from "@tanstack/react-router"
import { Loader2 } from "lucide-react"
import { useCancelRun } from "../matching.mutations"
import { formatDuration, TRIGGER_LABEL } from "../run-labels"
import { runProgress } from "../run-math"
import type { RunRow } from "@/domain/match-types"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

export function RunProgressCard({
  run,
  compact = false,
}: {
  run: RunRow
  compact?: boolean
}) {
  const cancel = useCancelRun()
  // The card re-renders on every 1 s poll, which keeps elapsed time and ETA current.
  const p = runProgress(run, Date.now())
  const queued = run.status === "queued"
  return (
    <article
      className="space-y-2 border bg-card p-3 text-card-foreground"
      aria-label={`Matching ${run.subjectLabel}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{run.subjectLabel}</p>
          <p className="text-xs text-muted-foreground">
            {TRIGGER_LABEL[run.trigger]} ·{" "}
            {run.subjectKind === "donor"
              ? "vs active patients"
              : "vs available donors"}{" "}
            · criteria v{run.criteriaVersion}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
          <Loader2 className="size-3 animate-spin" aria-hidden="true" />
          {queued
            ? "Queued"
            : run.cancelRequested
              ? "Cancelling"
              : `${p.percent}%`}
        </span>
      </div>
      <Progress
        value={queued ? null : p.percent}
        aria-label={`Matching progress for ${run.subjectLabel}`}
      />
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground tabular-nums">
          {run.processed}/{run.total ?? "…"} pairs · {run.passCount} pass ·{" "}
          {run.reviewCount} review · {run.failCount} fail
          {!queued &&
            ` · ${formatDuration(p.elapsedSeconds)}${p.etaSeconds !== null ? ` · ~${formatDuration(p.etaSeconds)} left` : ""}`}
        </span>
        <span className="flex gap-1">
          {!compact && (
            <Button
              size="sm"
              variant="ghost"
              nativeButton={false}
              render={<Link to="/matching/$runId" params={{ runId: run.id }} />}
            >
              Open
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            disabled={cancel.isPending || run.cancelRequested}
            data-guide="run-cancel"
            onClick={() => cancel.mutate(run.id)}
          >
            Cancel
          </Button>
        </span>
      </div>
    </article>
  )
}
