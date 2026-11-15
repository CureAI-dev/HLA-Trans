import { Link, createFileRoute } from "@tanstack/react-router"
import type { LinkOptions } from "@tanstack/react-router"
import { Database, History } from "lucide-react"
import { PageHeader } from "@/components/app/page-header"
import { PagePending } from "@/components/app/page-skeletons"
import { EmptyState } from "@/components/app/empty-state"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/app/status"
import { useSuspenseQuery } from "@tanstack/react-query"
import { dashboardQueries } from "@/features/dashboard/dashboard.queries"
import type { MatchRow } from "@/domain/match-types"

export const Route = createFileRoute("/")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(dashboardQueries.summary()),
  head: () => ({ meta: [{ title: "Dashboard · HLA-Trans" }] }),
  pendingComponent: PagePending,
  component: Dashboard,
})
function MatchList({
  records,
  empty,
  hint,
}: {
  records: Array<MatchRow>
  empty: string
  hint: string
}) {
  return records.length ? (
    <ul className="divide-y">
      {records.map((e) => (
        <li key={e.id}>
          <Link
            className="flex flex-wrap items-center justify-between gap-3 p-3 hover:bg-muted focus-visible:outline-2"
            to="/matches/$matchId"
            params={{ matchId: e.id }}
          >
            <span>
              <span className="block font-medium">
                {e.patientName} - {e.donorCode}
              </span>
              <time
                className="text-xs text-muted-foreground"
                dateTime={e.createdAt}
                suppressHydrationWarning
              >
                {new Date(e.createdAt).toLocaleString()}
              </time>
            </span>
            <StatusBadge status={e.overall} />
          </Link>
        </li>
      ))}
    </ul>
  ) : (
    <div className="p-4">
      <EmptyState
        icon={<History />}
        title={empty}
        description={hint}
        action={
          <Button variant="outline" nativeButton={false} render={<Link to="/matches/check" />}>
            Check a pair
          </Button>
        }
      />
    </div>
  )
}
function Dashboard() {
  const { data } = useSuspenseQuery(dashboardQueries.summary())
  const { recent, pending } = data
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Review candidates, donors, and saved match results."
        actions={
          <>
            <Button nativeButton={false} render={<Link to="/matches/check" />}>
              Check a pair
            </Button>
            <Button variant="outline" nativeButton={false} render={<Link to="/data" />}>
              Manage data
            </Button>
          </>
        }
      />
      {data.activePatients === 0 && data.availableDonors === 0 && !recent.length && (
        <div className="mb-6">
          <EmptyState
            icon={<Database />}
            title="The database is empty"
            description="Add patients and donors, or load the synthetic demo dataset to explore matching."
            action={
              <>
                <Button nativeButton={false} render={<Link to="/patients/new" />}>
                  Add patient
                </Button>
                <Button variant="outline" nativeButton={false} render={<Link to="/data" />}>
                  Load demo dataset
                </Button>
              </>
            }
          />
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        {(
          [
            {
              label: "Active candidates",
              count: data.activePatients,
              link: { to: "/patients" },
            },
            {
              label: "Available donors",
              count: data.availableDonors,
              link: { to: "/donors" },
            },
            {
              label: "Pending decisions",
              count: data.pendingDecisions,
              link: { to: "/", hash: "pending" },
            },
          ] satisfies Array<{ label: string; count: number; link: LinkOptions }>
        ).map((item) => (
          <Link
            key={item.label}
            {...item.link}
            className="border bg-card p-4 hover:bg-muted"
          >
            <span className="text-sm text-muted-foreground">{item.label}</span>
            <strong className="mt-2 block text-3xl tabular-nums">
              {item.count}
            </strong>
          </Link>
        ))}
      </div>
      <div className="my-6 grid gap-6 xl:grid-cols-2">
        <section id="pending" className="border bg-card">
          <h2 className="border-b p-4 font-semibold">
            Pending decisions ({data.pendingDecisions})
          </h2>
          <MatchList
            records={pending}
            empty="No decisions are pending."
            hint="Results saved with Check a pair wait here for a clinician decision."
          />
        </section>
        <section className="border bg-card">
          <h2 className="border-b p-4 font-semibold">Recent match results</h2>
          <MatchList
            records={recent}
            empty="No match results have been saved."
            hint="Saved results from matching and Check a pair appear here."
          />
        </section>
      </div>
      <div className="grid gap-6">
        <section className="border bg-card p-4">
          <h2 className="mb-4 font-semibold">
            Outcome mix of the {recent.length} most recent results
          </h2>
          <div
            role="img"
            aria-label={`Outcome mix of ${recent.length} saved match results: PASS ${recent.filter((e) => e.overall === "pass").length}, REVIEW ${recent.filter((e) => e.overall === "review").length}, FAIL ${recent.filter((e) => e.overall === "fail").length}`}
            className="space-y-3"
          >
            {(["pass", "review", "fail"] as const).map((status) => {
              const count = recent.filter(
                (e) => e.overall === status
              ).length
              return (
                <div key={status}>
                  <div className="mb-1 flex justify-between">
                    <StatusBadge status={status} />
                    <span className="tabular-nums">{count}</span>
                  </div>
                  <div className="h-3 bg-muted">
                    <div
                      className={
                        {
                          pass: "h-full bg-pass",
                          review: "h-full bg-caution",
                          fail: "h-full bg-fail",
                        }[status]
                      }
                      style={{
                        width: `${recent.length ? (count / recent.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
          {!recent.length && (
            <p className="mt-3 text-sm text-muted-foreground">
              Save a match result to populate the chart.
            </p>
          )}
        </section>
      </div>
    </>
  )
}
