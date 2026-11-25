import { Link, createFileRoute } from "@tanstack/react-router"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useSuspenseQuery } from "@tanstack/react-query"
import { ScrollText } from "lucide-react"
import { auditSearch } from "@/features/audit/audit.functions"
import { auditQueries } from "@/features/audit/audit.queries"
import { PageHeader } from "@/components/app/page-header"
import { Pager } from "@/components/app/pager"
import { FilterSelect, ListToolbar } from "@/components/app/list-toolbar"
import { TablePageSkeleton } from "@/components/app/page-skeletons"
import { EmptyState } from "@/components/app/empty-state"
import type { AuditAction } from "@/domain/match-types"
import { Button } from "@/components/ui/button"
import { LocalTime } from "@/components/app/local-time"

/** Every action the API writes, with readable labels for the filter. */
const ACTIONS = [
  { value: "patient.created", label: "Patient created" },
  { value: "patient.updated", label: "Patient updated" },
  { value: "patient.deleted", label: "Patient deleted" },
  { value: "donor.created", label: "Donor created" },
  { value: "donor.updated", label: "Donor updated" },
  { value: "donor.deleted", label: "Donor deleted" },
  { value: "match.checked", label: "Pair checked" },
  { value: "match.decided", label: "Decision recorded" },
  { value: "match_run.queued", label: "Match run queued" },
  { value: "match_run.succeeded", label: "Match run finished" },
  { value: "match_run.failed", label: "Match run failed" },
  { value: "match_run.cancelled", label: "Match run cancelled" },
  { value: "criteria.published", label: "Criteria published" },
  { value: "data.imported", label: "Data imported" },
  { value: "data.seeded", label: "Demo data loaded" },
  { value: "data.reset", label: "Database reset" },
] as const satisfies ReadonlyArray<{ value: AuditAction; label: string }>
type ActionValue = (typeof ACTIONS)[number]["value"]
const actionLabel = (a: string) =>
  ACTIONS.find((x) => x.value === a)?.label ?? a

export const Route = createFileRoute("/audit")({
  validateSearch: auditSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(auditQueries.list(deps)),
  head: () => ({ meta: [{ title: "Audit log · Concord" }] }),
  pendingComponent: () => <TablePageSkeleton columns={5} />,
  component: AuditPage,
})

function AuditPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data } = useSuspenseQuery(auditQueries.list(search))
  return (
    <>
      <PageHeader
        title="Audit log"
        description="Record of changes, match results, decisions, match runs and data operations."
      />
      <ListToolbar
        canReset={Boolean(search.action)}
        onReset={() => void navigate({ search: {}, replace: true })}
      >
        <FilterSelect
          label="Action"
          value={
            ACTIONS.some((a) => a.value === search.action)
              ? (search.action as ActionValue)
              : undefined
          }
          options={ACTIONS}
          onChange={(action) =>
            void navigate({ search: { action }, replace: true })
          }
        />
      </ListToolbar>
      <div data-guide="audit-list">
        <p className="mb-3 text-sm">Newest first. Times use your local time.</p>
        {data.items.length ? (
          <ScrollArea orientation="horizontal" className="border">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Audit entries, newest first</caption>
              <thead className="bg-muted">
                <tr>
                  {["Time", "Actor", "Action", "Subject", "Summary"].map(
                    (h) => (
                      <th key={h} scope="col" className="p-3">
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {data.items.map((e, i) => (
                  <tr
                    className="border-t"
                    key={e.id}
                    data-guide={i === 0 ? "audit-row" : undefined}
                  >
                    <td className="p-3 whitespace-nowrap">
                      <time dateTime={e.at} suppressHydrationWarning>
                        <LocalTime value={e.at} />
                      </time>
                    </td>
                    <td className="p-3">{e.actor}</td>
                    <td className="p-3">
                      {actionLabel(e.action)}
                      <span className="block font-mono text-xs text-muted-foreground">
                        {e.action}
                      </span>
                    </td>
                    <td className="max-w-64 p-3 break-words">{e.subjectId}</td>
                    <td className="p-3">{e.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        ) : search.action ? (
          <EmptyState
            icon={<ScrollText />}
            title="No entries for this action"
            description="Reset the filter to see every audit entry."
          />
        ) : (
          <EmptyState
            icon={<ScrollText />}
            title="No audit entries yet"
            description="Changes, match results, decisions and data operations are recorded here."
            action={
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link to="/data" />}
              >
                Load demo dataset
              </Button>
            }
          />
        )}
      </div>
      <Pager
        hasCursor={Boolean(search.cursor)}
        nextCursor={data.nextCursor}
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
