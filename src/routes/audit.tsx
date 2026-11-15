import { Link, createFileRoute } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import { auditSearch } from "@/features/audit/audit.functions"
import { auditQueries } from "@/features/audit/audit.queries"
import { PageHeader } from "@/components/app/page-header"
import { Pager } from "@/components/app/pager"
import { Button } from "@/components/ui/button"

const ACTIONS = [
  "patient.created",
  "patient.updated",
  "patient.deleted",
  "donor.created",
  "donor.updated",
  "donor.deleted",
  "match.checked",
  "match.decided",
  "match_run.queued",
  "match_run.succeeded",
  "match_run.failed",
  "match_run.cancelled",
  "criteria.published",
  "data.imported",
  "data.seeded",
  "data.reset",
] as const

export const Route = createFileRoute("/audit")({
  validateSearch: auditSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(auditQueries.list(deps)),
  head: () => ({ meta: [{ title: "Audit log · HLA-Trans" }] }),
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
      <div className="mb-5 grid items-end gap-4 border bg-card p-4 sm:grid-cols-3">
        <label className="space-y-2 text-sm">
          Action
          <select
            aria-label="Action"
            className="h-8 w-full border bg-background px-2"
            value={search.action ?? ""}
            onChange={(e) =>
              void navigate({
                search: { action: e.target.value || undefined },
              })
            }
          >
            <option value="">All actions</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        {search.action && (
          <Button variant="outline" onClick={() => void navigate({ search: {} })}>
            Clear filters
          </Button>
        )}
      </div>
      <p className="mb-3 text-sm">Newest first. Times use your local time.</p>
      {data.items.length ? (
        <div className="overflow-x-auto border">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Audit entries, newest first</caption>
            <thead className="bg-muted">
              <tr>
                {["Time", "Actor", "Action", "Subject", "Summary"].map((h) => (
                  <th key={h} scope="col" className="p-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.map((e) => (
                <tr className="border-t" key={e.id}>
                  <td className="p-3 whitespace-nowrap">
                    <time dateTime={e.at} suppressHydrationWarning>
                      {new Date(e.at).toLocaleString()}
                    </time>
                  </td>
                  <td className="p-3">{e.actor}</td>
                  <td className="p-3">{e.action}</td>
                  <td className="max-w-64 p-3 break-words">{e.subjectId}</td>
                  <td className="p-3">{e.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border p-6">
          <p>No audit entries match these filters.</p>
          <Link to="/data" className="mt-3 inline-block underline">
            Load synthetic demo data
          </Link>
        </div>
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
