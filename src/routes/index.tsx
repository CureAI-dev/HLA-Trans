import { createFileRoute } from "@tanstack/react-router"
import { PageHeader } from "@/components/app/page-header"

export const Route = createFileRoute("/")({ component: Dashboard })
function Dashboard() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Review candidates, donor records, and heart compatibility evaluations."
      />
      <div className="border bg-card p-6">
        <h2 className="font-semibold">Start a compatibility review</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Select records or manage local data to begin.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <a
            className="border bg-primary px-4 py-2 text-sm text-primary-foreground"
            href="/evaluations/new"
          >
            New evaluation
          </a>
          <a className="border px-4 py-2 text-sm" href="/data">
            Manage data
          </a>
        </div>
      </div>
    </>
  )
}
