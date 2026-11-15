import { createFileRoute } from "@tanstack/react-router"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { Activity } from "lucide-react"
import { runHistorySearch } from "@/features/matching/matching.functions"
import type { RunHistorySearch } from "@/features/matching/matching.functions"
import { matchingQueries } from "@/features/matching/matching.queries"
import { RunProgressCard } from "@/features/matching/components/run-progress-card"
import { RunHistoryTable } from "@/features/matching/components/run-history-table"
import { PageHeader } from "@/components/app/page-header"
import { FilterSelect, ListToolbar } from "@/components/app/list-toolbar"
import { Pager } from "@/components/app/pager"
import { EmptyState } from "@/components/app/empty-state"
import { TablePageSkeleton } from "@/components/app/page-skeletons"

const STATUS_OPTIONS = [
  { value: "succeeded", label: "Succeeded" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "running", label: "Running" },
  { value: "queued", label: "Queued" },
] as const

const SUBJECT_OPTIONS = [
  { value: "donor", label: "Donor" },
  { value: "patient", label: "Patient" },
] as const

export const Route = createFileRoute("/matching/")({
  validateSearch: runHistorySearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    Promise.all([
      context.queryClient.ensureQueryData(matchingQueries.active()),
      context.queryClient.ensureQueryData(matchingQueries.history(deps)),
    ]),
  head: () => ({ meta: [{ title: "Matching · HLA-Trans" }] }),
  pendingComponent: () => <TablePageSkeleton columns={8} />,
  component: MatchingPage,
})

function MatchingPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  // The active list polls; it is read without suspense so a poll never suspends the page.
  const { data: active = [] } = useQuery(matchingQueries.active())
  const { data: history } = useSuspenseQuery(matchingQueries.history(search))
  const setFilter = (patch: Partial<RunHistorySearch>) =>
    void navigate({
      search: (s) => ({ ...s, ...patch, cursor: undefined }),
      replace: true,
    })
  return (
    <>
      <PageHeader
        title="Matching"
        description="Background screening runs. Saving a patient or donor starts one automatically. Screening order is not OPTN allocation."
      />
      <section aria-labelledby="active-runs" className="mb-8">
        <h2 id="active-runs" className="mb-3 text-sm font-semibold">
          Active ({active.length})
        </h2>
        {active.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {active.map((run) => (
              <RunProgressCard key={run.id} run={run} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Activity />}
            title="Nothing running"
            description="New patients and donors are matched here automatically."
          />
        )}
      </section>
      <section aria-labelledby="run-history">
        <h2 id="run-history" className="mb-3 text-sm font-semibold">
          History
        </h2>
        <ListToolbar
          canReset={Boolean(
            search.status || search.subjectKind || search.subjectId
          )}
          onReset={() => void navigate({ search: {}, replace: true })}
        >
          <FilterSelect
            label="Status"
            value={search.status}
            options={STATUS_OPTIONS}
            onChange={(status) => setFilter({ status })}
          />
          <FilterSelect
            label="Subject"
            value={search.subjectKind}
            options={SUBJECT_OPTIONS}
            onChange={(subjectKind) => setFilter({ subjectKind })}
          />
        </ListToolbar>
        <RunHistoryTable rows={history.items} />
        <Pager
          hasCursor={Boolean(search.cursor)}
          nextCursor={history.nextCursor}
          onFirst={() =>
            void navigate({ search: (s) => ({ ...s, cursor: undefined }) })
          }
          onNext={(cursor) =>
            void navigate({ search: (s) => ({ ...s, cursor }) })
          }
        />
      </section>
    </>
  )
}
