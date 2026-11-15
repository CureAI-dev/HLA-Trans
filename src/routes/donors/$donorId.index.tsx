import { useState } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { donorQueries } from "@/features/donors/donors.queries"
import { useDeleteDonor, useRerunDonor } from "@/features/donors/donors.mutations"
import { matchQueries } from "@/features/matches/matches.queries"
import { matchingQueries } from "@/features/matching/matching.queries"
import { ensureOrNotFound } from "@/lib/route-helpers"
import { DonorSummary } from "@/components/donor/donor-summary"
import { ScreeningResults } from "@/components/donor/screening-results"
import { PageHeader } from "@/components/app/page-header"
import { RecordActions, toastMatchingStarted } from "@/components/app/page-actions"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"

const latestRunSearch = (donorId: string) =>
  ({ subjectKind: "donor", subjectId: donorId, status: "succeeded" }) as const

export const Route = createFileRoute("/donors/$donorId/")({
  loader: async ({ context, params }) => {
    // Not awaited: the latest run is only needed for the Screen candidates tab.
    void context.queryClient.prefetchQuery(
      matchingQueries.history(latestRunSearch(params.donorId))
    )
    await ensureOrNotFound(
      context.queryClient.ensureQueryData(donorQueries.detail(params.donorId))
    )
  },
  component: DonorDetail,
})

/** Results of the donor's newest finished match run, in screening order. */
function DonorScreening({ donorId }: { donorId: string }) {
  const runs = useQuery(matchingQueries.history(latestRunSearch(donorId)))
  const runId = runs.data?.items[0]?.id
  const results = useQuery({
    ...matchQueries.list({ donorId, runId, order: "screen" }),
    enabled: Boolean(runId),
  })
  if (runs.isPending || (runId && results.isPending))
    return (
      <p className="text-sm text-muted-foreground">Loading screening results…</p>
    )
  return <ScreeningResults donorId={donorId} rows={results.data?.items ?? []} />
}

function DonorDetail() {
  const { donorId } = Route.useParams()
  const {
    data: { record: donor },
  } = useSuspenseQuery(donorQueries.detail(donorId))
  const del = useDeleteDonor()
  const rerun = useRerunDonor()
  const navigate = useNavigate()
  const [tab, setTab] = useState("summary")
  return (
    <>
      <PageHeader
        title={donor.identity.donorId}
        description={`${donor.identity.donorHospital || "Hospital not recorded"} · ${donor.identity.state}`}
        actions={
          <RecordActions
            entityLabel="donor"
            editLink={{ to: "/donors/$donorId/edit", params: { donorId } }}
            checkLink={{ to: "/matches/check", search: { donorId } }}
            onRerun={() =>
              rerun.mutate(donorId, {
                onSuccess: ({ runId }) =>
                  toastMatchingStarted(
                    () => void navigate({ to: "/matches", search: { runId } })
                  ),
              })
            }
            rerunPending={rerun.isPending}
            deletePending={del.isPending}
            onDelete={async () => {
              await del.mutateAsync(donorId)
              toast.add({ title: "Donor deleted" })
              void navigate({ to: "/donors" })
            }}
          />
        }
      />
      <div role="tablist" aria-label="Donor views" className="mb-4 flex gap-2">
        {[
          ["summary", "Summary"],
          ["screen", "Screen candidates"],
        ].map(([id, title]) => (
          <Button
            key={id}
            id={`tab-${id}`}
            role="tab"
            aria-controls={`panel-${id}`}
            aria-selected={tab === id}
            tabIndex={tab === id ? 0 : -1}
            onKeyDown={(event) => {
              if (
                !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              )
                return
              event.preventDefault()
              const next =
                event.key === "Home"
                  ? "summary"
                  : event.key === "End"
                    ? "screen"
                    : tab === "summary"
                      ? "screen"
                      : "summary"
              setTab(next)
              document.getElementById(`tab-${next}`)?.focus()
            }}
            variant={tab === id ? "default" : "outline"}
            onClick={() => setTab(id)}
          >
            {title}
          </Button>
        ))}
      </div>
      <div
        role="tabpanel"
        tabIndex={0}
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
      >
        {tab === "summary" ? (
          <DonorSummary donor={donor} />
        ) : (
          <DonorScreening donorId={donor.id} />
        )}
      </div>
    </>
  )
}
