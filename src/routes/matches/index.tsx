import { useCallback } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import { History, X } from "lucide-react"
import { matchListSearch } from "@/features/matches/matches.functions"
import type { MatchListSearch } from "@/features/matches/matches.functions"
import { matchQueries } from "@/features/matches/matches.queries"
import { PageHeader } from "@/components/app/page-header"
import { Pager } from "@/components/app/pager"
import { FilterSelect, ListToolbar } from "@/components/app/list-toolbar"
import { TablePageSkeleton } from "@/components/app/page-skeletons"
import { EmptyState } from "@/components/app/empty-state"
import { MatchTable } from "@/components/match/match-table"
import { DatePickerField } from "@/components/form/date-picker-field"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

const OVERALL = [
  { value: "pass", label: "PASS" },
  { value: "review", label: "REVIEW" },
  { value: "fail", label: "FAIL" },
] as const
const DECISION = [
  { value: "pending", label: "Pending" },
  { value: "decided", label: "Decided" },
] as const
const SOURCE = [
  { value: "screening", label: "Screening" },
  { value: "checked", label: "Checked pair" },
] as const

const isoDay = /^\d{4}-\d{2}-\d{2}$/

export const Route = createFileRoute("/matches/")({
  validateSearch: matchListSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(matchQueries.list(deps)),
  head: () => ({ meta: [{ title: "Match results · HLA-Trans" }] }),
  pendingComponent: () => <TablePageSkeleton columns={6} />,
  component: MatchResults,
})

/** Toolbar date filter: the label stays for screen readers but is hidden so the row stays one line. */
function DateFilter({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string
  value: string | undefined
  onChange: (v: string | undefined) => void
  min?: string
  max?: string
}) {
  return (
    <div className="w-44 [&_label]:sr-only">
      <DatePickerField
        label={label}
        value={value ?? ""}
        min={min}
        max={max}
        disableFuture
        captionLayout="label"
        onChange={(v) => onChange(isoDay.test(v) ? v : undefined)}
      />
    </div>
  )
}

function MatchResults() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data } = useSuspenseQuery(matchQueries.list(search))
  // Any filter change starts again from the first page.
  const set = useCallback(
    (patch: Partial<MatchListSearch>) =>
      void navigate({
        search: (prev) => ({ ...prev, ...patch, cursor: undefined }),
        replace: true,
      }),
    [navigate]
  )
  const filtered = Boolean(
    search.overall ||
      search.decision ||
      search.source ||
      search.from ||
      search.to ||
      search.runId ||
      search.patientId ||
      search.donorId
  )
  return (
    <>
      <PageHeader
        title="Match results"
        description="Saved compatibility results from matching and Check a pair, with final clinician decisions."
        actions={
          <Button nativeButton={false} render={<Link to="/matches/check" />}>
            Check a pair
          </Button>
        }
      />
      <ListToolbar
        canReset={filtered}
        onReset={() => void navigate({ search: {}, replace: true })}
      >
        <FilterSelect label="Result" value={search.overall} options={OVERALL} onChange={(overall) => set({ overall })} />
        <FilterSelect label="Decision" value={search.decision} options={DECISION} onChange={(decision) => set({ decision })} />
        <FilterSelect label="Source" value={search.source} options={SOURCE} onChange={(source) => set({ source })} />
        <DateFilter label="Saved from" value={search.from} max={search.to} onChange={(from) => set({ from })} />
        <DateFilter label="Saved through" value={search.to} min={search.from} onChange={(to) => set({ to })} />
        {search.runId && (
          <Badge variant="outline" className="h-8 gap-1.5 px-2">
            One match run
            <button
              type="button"
              aria-label="Show results from all match runs"
              className="inline-flex"
              onClick={() => set({ runId: undefined })}
            >
              <X className="size-3" aria-hidden="true" />
            </button>
          </Badge>
        )}
      </ListToolbar>
      {data.items.length || filtered ? (
        <MatchTable
          rows={data.items}
          emptyText={
            search.runId
              ? "Results appear as the match run processes pairs."
              : "No saved results match these filters."
          }
        />
      ) : (
        <EmptyState
          icon={<History />}
          title="No match results yet"
          description="Matching saves results automatically when patients and donors are added. Check a pair to save one now."
          action={
            <Button nativeButton={false} render={<Link to="/matches/check" />}>
              Check a pair
            </Button>
          }
        />
      )}
      <Pager
        hasCursor={Boolean(search.cursor)}
        nextCursor={data.nextCursor}
        onFirst={() => void navigate({ search: (s) => ({ ...s, cursor: undefined }) })}
        onNext={(cursor) => void navigate({ search: (s) => ({ ...s, cursor }) })}
      />
    </>
  )
}
