import { Link, createFileRoute } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import { matchListSearch } from "@/features/matches/matches.functions"
import type { MatchListSearch } from "@/features/matches/matches.functions"
import { matchQueries } from "@/features/matches/matches.queries"
import { PageHeader } from "@/components/app/page-header"
import { Pager } from "@/components/app/pager"
import { StatusBadge } from "@/components/app/status"
import { DateField, SelectField } from "@/components/form"

export const Route = createFileRoute("/matches/")({
  validateSearch: matchListSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(matchQueries.list(deps)),
  head: () => ({ meta: [{ title: "Match results · HLA-Trans" }] }),
  component: MatchResults,
})

const isoDay = /^\d{4}-\d{2}-\d{2}$/

function MatchResults() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data } = useSuspenseQuery(matchQueries.list(search))
  // Any filter change starts again from the first page.
  const setFilter = (patch: Partial<MatchListSearch>) =>
    void navigate({ search: (s) => ({ ...s, ...patch, cursor: undefined }) })
  return (
    <div className="space-y-5">
      <PageHeader
        title="Match results"
        description="Saved compatibility results from matching and Check a pair, with final clinician decisions."
        actions={
          <Link to="/matches/check" className="border px-3 py-2">
            Check a pair
          </Link>
        }
      />
      <div className="grid gap-4 md:grid-cols-4">
        <SelectField
          label="Overall verdict"
          value={search.overall ?? "all"}
          onChange={(v) =>
            setFilter({ overall: v === "all" ? undefined : (v) })
          }
          options={[
            { value: "all", label: "All verdicts" },
            { value: "pass", label: "PASS" },
            { value: "review", label: "REVIEW" },
            { value: "fail", label: "FAIL" },
          ]}
        />
        <SelectField
          label="Decision status"
          value={search.decision ?? "all"}
          onChange={(v) =>
            setFilter({ decision: v === "all" ? undefined : (v) })
          }
          options={[
            { value: "all", label: "All decisions" },
            { value: "pending", label: "Pending" },
            { value: "decided", label: "Decided" },
          ]}
        />
        <DateField
          label="Saved from"
          value={search.from ?? ""}
          onChange={(v) => setFilter({ from: isoDay.test(v) ? v : undefined })}
        />
        <DateField
          label="Saved through"
          value={search.to ?? ""}
          onChange={(v) => setFilter({ to: isoDay.test(v) ? v : undefined })}
        />
      </div>
      {data.items.length ? (
        <div className="overflow-x-auto border">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Saved match results</caption>
            <thead className="bg-muted">
              <tr>
                {["Saved", "Patient", "Donor", "Source", "Result", "Decision", "Criteria"].map(
                  (h) => (
                    <th key={h} scope="col" className="p-3">
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {data.items.map((m) => (
                <tr className="border-t" key={m.id}>
                  <td className="p-3">
                    <Link
                      className="underline"
                      to="/matches/$matchId"
                      params={{ matchId: m.id }}
                    >
                      <time dateTime={m.createdAt} suppressHydrationWarning>
                        {new Date(m.createdAt).toLocaleString()}
                      </time>
                    </Link>
                  </td>
                  <td className="p-3">{m.patientName}</td>
                  <td className="p-3">{m.donorCode}</td>
                  <td className="p-3">
                    {m.source === "checked" ? "Check a pair" : "Matching"}
                  </td>
                  <td className="p-3">
                    <StatusBadge status={m.overall} />
                    {m.outOfDate && (
                      <p className="mt-1 text-xs text-muted-foreground">Out of date</p>
                    )}
                  </td>
                  <td className="p-3">
                    {m.decision ?? (m.source === "checked" ? "Pending" : "Not applicable")}
                  </td>
                  <td className="p-3">v{m.criteriaVersion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>
          No match results match these filters.{" "}
          <Link className="underline" to="/matches/check">
            Check a pair
          </Link>
          .
        </p>
      )}
      <Pager
        hasCursor={Boolean(search.cursor)}
        nextCursor={data.nextCursor}
        onFirst={() => void navigate({ search: (s) => ({ ...s, cursor: undefined }) })}
        onNext={(cursor) => void navigate({ search: (s) => ({ ...s, cursor }) })}
      />
    </div>
  )
}
