import { Link, createFileRoute } from "@tanstack/react-router"
import type { LinkOptions } from "@tanstack/react-router"
import { PageHeader } from "@/components/app/page-header"
import { StatusBadge } from "@/components/app/status"
import { dbStore, useDb } from "@/lib/storage/db"
import type { Evaluation } from "@/domain/schema"

export const Route = createFileRoute("/")({ component: Dashboard })
function EvaluationList({
  records,
  empty,
}: {
  records: Array<Evaluation>
  empty: string
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
                {e.patientSnapshot.identity.firstName}{" "}
                {e.patientSnapshot.identity.lastName} -{" "}
                {e.donorSnapshot.identity.donorId}
              </span>
              <time
                className="text-xs text-muted-foreground"
                dateTime={e.createdAt}
              >
                {new Date(e.createdAt).toLocaleString()}
              </time>
            </span>
            <StatusBadge status={e.result.overall} />
          </Link>
        </li>
      ))}
    </ul>
  ) : (
    <p className="p-4 text-sm text-muted-foreground">
      {empty}{" "}
      <Link className="underline" to="/matches/check">
        Check a pair
      </Link>
      .
    </p>
  )
}
function Dashboard() {
  const db = useDb()
  const recent = [...db.evaluations].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  )
  const pending = recent.filter((e) => !e.decision)
  let usage = "Unavailable"
  try {
    usage = `${(dbStore.sizeInBytes() / 1024).toFixed(1)} KiB`
  } catch {
    /* Storage access may be blocked. */
  }
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Review candidates, donors, and saved match results."
      />
      <div className="mb-6 flex flex-wrap gap-4">
        <Link className="underline" to="/matches/check">
          Check a pair
        </Link>
        <Link className="underline" to="/data">
          Manage local data
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {(
          [
            {
              label: "Active candidates",
              count: db.patients.filter((p) => p.listing.state === "active")
                .length,
              link: { to: "/patients" },
            },
            {
              label: "Available donors",
              count: db.donors.filter((d) => d.identity.state === "available")
                .length,
              link: { to: "/donors" },
            },
            {
              label: "Pending decisions",
              count: pending.length,
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
            Pending decisions ({pending.length})
          </h2>
          <EvaluationList
            records={pending.slice(0, 5)}
            empty="No decisions are pending."
          />
        </section>
        <section className="border bg-card">
          <h2 className="border-b p-4 font-semibold">Recent match results</h2>
          <EvaluationList
            records={recent.slice(0, 5)}
            empty="No match results have been saved."
          />
        </section>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <section className="border bg-card p-4">
          <h2 className="mb-4 font-semibold">Saved match result outcome mix</h2>
          <div
            role="img"
            aria-label={`Outcome mix of ${recent.length} saved match results: PASS ${recent.filter((e) => e.result.overall === "pass").length}, REVIEW ${recent.filter((e) => e.result.overall === "review").length}, FAIL ${recent.filter((e) => e.result.overall === "fail").length}`}
            className="space-y-3"
          >
            {(["pass", "review", "fail"] as const).map((status) => {
              const count = recent.filter(
                (e) => e.result.overall === status
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
        <section className="border bg-card p-4">
          <h2 className="font-semibold">Browser storage</h2>
          <p className="my-3 text-2xl tabular-nums">{usage}</p>
          <p className="text-sm text-muted-foreground">
            Database usage in this browser. Browser quota varies; export a
            backup before clearing browser data.
          </p>
          <Link className="mt-4 inline-block underline" to="/data">
            Export or manage data
          </Link>
        </section>
      </div>
    </>
  )
}
