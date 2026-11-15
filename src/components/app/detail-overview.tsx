import { useEffect, useRef } from "react"
import type { ReactNode } from "react"
import { Link } from "@tanstack/react-router"
import type { LinkOptions } from "@tanstack/react-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { CircleCheck, Info, OctagonX, Pencil, RefreshCw, TriangleAlert } from "lucide-react"
import { cn } from "cn"
import type { RiskFlag } from "@/domain/risk-flags"
import type { RunRow } from "@/domain/match-types"
import { formatRecordValue, getAtPath, isBlank } from "@/components/record/record-spec"
import type { RecordField, RecordSection } from "@/components/record/record-spec"
import { matchingKeys, matchingQueries } from "@/features/matching/matching.queries"
import { matchKeys } from "@/features/matches/matches.queries"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"

export function OverviewCard({
  title,
  action,
  children,
  className,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  const id = `card-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
  return (
    <section aria-labelledby={id} className={cn("border bg-card", className)}>
      <header className="flex min-h-10 items-center justify-between gap-2 border-b px-4 py-2">
        <h2 id={id} className="text-sm font-semibold">
          {title}
        </h2>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  )
}

function findField(sections: ReadonlyArray<RecordSection>, path: string): { field: RecordField; section: RecordSection } | null {
  for (const section of sections) {
    const field = section.fields.find((f) => f.path === path)
    if (field) return { field, section }
  }
  return null
}

/** A few record values, with the same labels and formatting as the Clinical record tab. */
export function KeyFacts({
  sections,
  record,
  paths,
}: {
  sections: ReadonlyArray<RecordSection>
  record: unknown
  paths: ReadonlyArray<string>
}) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {paths.map((path) => {
        const hit = findField(sections, path)
        if (!hit) return null
        const v = getAtPath(record, path)
        const blank = isBlank(v)
        return (
          <div key={path}>
            <dt className="text-xs text-muted-foreground">{hit.field.label}</dt>
            <dd className={blank ? "text-sm text-muted-foreground italic" : "text-sm font-medium whitespace-pre-wrap"}>
              {blank ? "Not recorded" : formatRecordValue(hit.field, v)}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

const SEVERITY = {
  fail: { icon: OctagonX, word: "FAIL", color: "text-fail" },
  review: { icon: TriangleAlert, word: "REVIEW", color: "text-caution" },
  info: { icon: Info, word: "INFO", color: "text-unknown" },
} as const

export function RiskFlagsCard({ flags, editLink }: { flags: ReadonlyArray<RiskFlag>; editLink: LinkOptions }) {
  return (
    <OverviewCard title="Risk flags">
      {flags.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CircleCheck className="size-4 text-pass" aria-hidden="true" />
          No risk flags from recorded data
        </p>
      ) : (
        <ul className="divide-y">
          {flags.map((f) => {
            const s = SEVERITY[f.severity]
            return (
              <li key={f.id} className="flex items-start gap-3 py-2 first:pt-0 last:pb-0">
                <s.icon className={cn("mt-0.5 size-4 shrink-0", s.color)} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    <span className={cn("mr-2 text-xs font-semibold", s.color)}>{s.word}</span>
                    {f.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{f.detail}</p>
                </div>
                <Link
                  {...editLink}
                  hash={f.section}
                  aria-label={`Edit data for ${f.title}`}
                  className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="size-3" aria-hidden="true" /> Edit
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Facts that need a clinician&apos;s review, using the active criteria. Not a verdict.
      </p>
    </OverviewCard>
  )
}

/**
 * Blank fields across the record spec. `relevant` drops fields that do not
 * apply to this record (DCD times for a DBD donor, free-text notes).
 * `priority` lists the fields matching depends on; they are shown first.
 */
export function CompletenessCard({
  sections,
  record,
  priority,
  relevant = () => true,
  editLink,
}: {
  sections: ReadonlyArray<RecordSection>
  record: unknown
  priority: ReadonlyArray<string>
  relevant?: (path: string) => boolean
  editLink: LinkOptions
}) {
  const all = sections
    .flatMap((section) => section.fields.map((field) => ({ field, section })))
    .filter(({ field }) => relevant(field.path))
  const missing = all.filter(({ field }) => isBlank(getAtPath(record, field.path)))
  const rank = (path: string) => {
    const i = priority.indexOf(path)
    return i === -1 ? priority.length : i
  }
  const top = [...missing].sort((a, b) => rank(a.field.path) - rank(b.field.path)).slice(0, 5)
  const recorded = all.length - missing.length
  const percent = all.length ? Math.round((recorded / all.length) * 100) : 100
  const keyMissing = missing.filter(({ field }) => priority.includes(field.path)).length
  return (
    <OverviewCard title="Data completeness">
      <div className="mb-2 flex items-baseline justify-between gap-2 text-sm">
        <span>
          <strong className="tabular-nums">{recorded}</strong> of <span className="tabular-nums">{all.length}</span> fields recorded
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">{percent}%</span>
      </div>
      <Progress value={percent} aria-label="Record completeness" />
      {keyMissing > 0 && (
        <p className="mt-3 flex items-center gap-2 text-xs">
          <TriangleAlert className="size-3.5 text-caution" aria-hidden="true" />
          {keyMissing} field{keyMissing === 1 ? "" : "s"} used by matching {keyMissing === 1 ? "is" : "are"} blank; affected rules return REVIEW.
        </p>
      )}
      {top.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {top.map(({ field, section }) => (
            <li key={field.path}>
              <Link {...editLink} hash={section.id} className="underline-offset-4 hover:underline">
                {field.label}
              </Link>{" "}
              <span className="text-xs text-muted-foreground">({section.title})</span>
            </li>
          ))}
        </ul>
      )}
    </OverviewCard>
  )
}

const TRIGGER: Record<RunRow["trigger"], string> = {
  "donor.created": "New donor",
  "patient.created": "New patient",
  manual: "Manual rerun",
  seed: "Demo data",
}
const STATUS: Record<RunRow["status"], string> = {
  queued: "Queued",
  running: "Running",
  succeeded: "Finished",
  failed: "Failed",
  cancelled: "Cancelled",
}
const when = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" })
const isLive = (r: RunRow) => r.status === "queued" || r.status === "running"

/** Newest match run for a record, live while it runs, with Open and Rerun. */
export function LatestRunCard({
  subjectKind,
  subjectId,
  onRerun,
  rerunPending,
  openLink,
}: {
  subjectKind: RunRow["subjectKind"]
  subjectId: string
  onRerun: () => void
  rerunPending: boolean
  openLink: (runId: string) => LinkOptions
}) {
  const qc = useQueryClient()
  const history = useQuery(matchingQueries.history({ subjectKind, subjectId }))
  const newest = history.data?.items[0]
  // The detail query polls every second while the run is live.
  const detail = useQuery({ ...matchingQueries.detail(newest?.id ?? ""), enabled: Boolean(newest && isLive(newest)) })
  const run = detail.data ?? newest
  const wasLive = useRef(false)
  useEffect(() => {
    if (!run) return
    if (isLive(run)) wasLive.current = true
    else if (wasLive.current) {
      wasLive.current = false
      void qc.invalidateQueries({ queryKey: matchingKeys.all })
      void qc.invalidateQueries({ queryKey: matchKeys.all })
    }
  }, [run, qc])
  return (
    <OverviewCard
      title="Latest matching"
      action={
        <Button size="sm" variant="outline" disabled={rerunPending} onClick={onRerun}>
          {rerunPending ? <Spinner aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
          Rerun matching
        </Button>
      }
    >
      {history.isPending ? (
        <div className="space-y-2" aria-busy="true">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
      ) : !run ? (
        <p className="text-sm text-muted-foreground">No match runs yet for this record.</p>
      ) : (
        <div className="space-y-2 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2 font-medium">
              {isLive(run) && <Spinner className="size-3" aria-hidden="true" />}
              {STATUS[run.status]}
              <span className="font-normal text-muted-foreground">
                · {TRIGGER[run.trigger]} · criteria v{run.criteriaVersion}
              </span>
            </span>
            <Button size="sm" variant="ghost" nativeButton={false} render={<Link {...openLink(run.id)} />}>
              Open
            </Button>
          </div>
          {isLive(run) && run.total !== null && run.total > 0 && (
            <Progress value={Math.round((run.processed / run.total) * 100)} aria-label="Matching progress" />
          )}
          <p className="tabular-nums">
            <span className="text-pass">{run.passCount} pass</span> ·{" "}
            <span className="text-caution">{run.reviewCount} review</span> ·{" "}
            <span className="text-fail">{run.failCount} fail</span>
            {run.total !== null && <span className="text-muted-foreground"> · {run.processed}/{run.total} pairs</span>}
          </p>
          {run.error && <p className="text-xs text-fail">{run.error}</p>}
          <p className="text-xs text-muted-foreground">
            {run.finishedAt ? "Finished " : "Started "}
            <time dateTime={run.finishedAt ?? run.createdAt} suppressHydrationWarning>
              {when.format(new Date(run.finishedAt ?? run.createdAt))}
            </time>{" "}
            by {run.createdBy}
          </p>
        </div>
      )}
    </OverviewCard>
  )
}
