import { createFileRoute } from "@tanstack/react-router"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { z } from "zod"
import type { ReactNode } from "react"
import { matchingQueries } from "@/features/matching/matching.queries"
import { RunProgressCard } from "@/features/matching/components/run-progress-card"
import {
  formatDuration,
  isLiveRun,
  STATUS_LABEL,
  TRIGGER_LABEL,
} from "@/features/matching/run-labels"
import { matchQueries } from "@/features/matches/matches.queries"
import { MatchTable } from "@/components/match/match-table"
import { PageHeader } from "@/components/app/page-header"
import { Pager } from "@/components/app/pager"
import { DetailPageSkeleton } from "@/components/app/page-skeletons"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ensureOrNotFound } from "@/lib/route-helpers"

const runSearch = z.object({
  overall: z.enum(["pass", "review", "fail"]).optional().catch(undefined),
  cursor: z.string().max(600).optional().catch(undefined),
})
type Overall = NonNullable<z.infer<typeof runSearch>["overall"]>
const isOverall = (v: unknown): v is Overall =>
  v === "pass" || v === "review" || v === "fail"

const resultsQuery = (runId: string, search: z.infer<typeof runSearch>) =>
  matchQueries.list({ runId, order: "screen", ...search })

export const Route = createFileRoute("/matching/$runId")({
  validateSearch: runSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ context, params, deps }) => {
    const [run] = await Promise.all([
      ensureOrNotFound(
        context.queryClient.ensureQueryData(
          matchingQueries.detail(params.runId)
        )
      ),
      context.queryClient.ensureQueryData(resultsQuery(params.runId, deps)),
    ])
    return { subjectLabel: run.subjectLabel }
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `Matching · ${loaderData.subjectLabel} · HLA-Trans`
          : "Matching · HLA-Trans",
      },
    ],
  }),
  pendingComponent: DetailPageSkeleton,
  component: RunPage,
})

function RunPage() {
  const { runId } = Route.useParams()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  // detail() polls every second while the run is live and stops once it finishes.
  const { data: run } = useSuspenseQuery(matchingQueries.detail(runId))
  const live = isLiveRun(run)
  // While running, refresh the visible page of results every 2 s. RunWatcher
  // invalidates match queries once more when the run finishes.
  const results = useQuery({
    ...resultsQuery(runId, search),
    refetchInterval: live ? 2_000 : false,
    refetchIntervalInBackground: false,
  })
  const total = run.passCount + run.reviewCount + run.failCount
  return (
    <>
      <PageHeader
        title={`Matching · ${run.subjectLabel}`}
        description="Screening order: outcome, urgency, pediatric priority, blood type priority, time at status. Not OPTN allocation."
        breadcrumbs={[
          { label: "Matching", link: { to: "/matching" } },
          { label: run.subjectLabel },
        ]}
      />
      {live ? (
        <div className="mb-6 max-w-xl">
          <RunProgressCard run={run} compact />
        </div>
      ) : (
        <dl className="mb-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Fact label="Status">
            {STATUS_LABEL[run.status]}
            {run.error ? ` · ${run.error}` : ""}
          </Fact>
          <Fact label="Subject">
            {run.subjectKind === "donor" ? "Donor" : "Patient"}
          </Fact>
          <Fact label="Trigger">{TRIGGER_LABEL[run.trigger]}</Fact>
          <Fact label="Criteria">v{run.criteriaVersion}</Fact>
          <Fact label="Pairs">
            {run.processed}/{run.total ?? "—"}
          </Fact>
          {run.startedAt && run.finishedAt && (
            <Fact label="Duration">
              {formatDuration(
                (Date.parse(run.finishedAt) - Date.parse(run.startedAt)) / 1000
              )}
            </Fact>
          )}
          <Fact label="Started by">{run.createdBy}</Fact>
        </dl>
      )}
      <Tabs
        value={search.overall ?? "all"}
        onValueChange={(v) =>
          void navigate({
            search: { overall: isOverall(v) ? v : undefined },
            replace: true,
          })
        }
      >
        <TabsList className="mb-4">
          <TabsTrigger value="all">All ({total})</TabsTrigger>
          <TabsTrigger value="pass">Pass ({run.passCount})</TabsTrigger>
          <TabsTrigger value="review">Review ({run.reviewCount})</TabsTrigger>
          <TabsTrigger value="fail">Fail ({run.failCount})</TabsTrigger>
        </TabsList>
      </Tabs>
      <MatchTable
        rows={results.data?.items ?? []}
        showPatient={run.subjectKind === "donor"}
        showDonor={run.subjectKind === "patient"}
        emptyText={
          live
            ? "Results appear as pairs are processed."
            : "No results in this group."
        }
      />
      <Pager
        hasCursor={Boolean(search.cursor)}
        nextCursor={results.data?.nextCursor ?? null}
        onFirst={() =>
          void navigate({ search: (s) => ({ ...s, cursor: undefined }) })
        }
        onNext={(cursor) =>
          void navigate({ search: (s) => ({ ...s, cursor }) })
        }
      />
    </>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  )
}
