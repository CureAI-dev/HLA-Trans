import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { patientQueries } from "@/features/patients/patients.queries"
import { useDeletePatient, useRerunPatient } from "@/features/patients/patients.mutations"
import { matchQueries } from "@/features/matches/matches.queries"
import { ensureOrNotFound } from "@/lib/route-helpers"
import { PatientSummary } from "@/components/patient/patient-summary"
import { PageHeader } from "@/components/app/page-header"
import { RecordActions, toastMatchingStarted } from "@/components/app/page-actions"
import { StatusBadge } from "@/components/app/status"
import { toast } from "@/components/ui/toast"

export const Route = createFileRoute("/patients/$patientId/")({
  loader: async ({ context, params }) => {
    // Not awaited: the matches list streams in after the record.
    void context.queryClient.prefetchQuery(
      matchQueries.list({ patientId: params.patientId })
    )
    await ensureOrNotFound(
      context.queryClient.ensureQueryData(
        patientQueries.detail(params.patientId)
      )
    )
  },
  component: PatientDetail,
})
function PatientDetail() {
  const { patientId } = Route.useParams()
  const {
    data: { record: p },
  } = useSuspenseQuery(patientQueries.detail(patientId))
  const matches = useQuery(matchQueries.list({ patientId }))
  const del = useDeletePatient()
  const rerun = useRerunPatient()
  const navigate = useNavigate()
  const evaluations = matches.data?.items ?? []
  return (
    <>
      <PageHeader
        title={`${p.identity.firstName} ${p.identity.lastName}`}
        description={`MRN ${p.identity.mrn}`}
        actions={
          <RecordActions
            entityLabel="patient"
            editLink={{ to: "/patients/$patientId/edit", params: { patientId } }}
            checkLink={{ to: "/matches/check", search: { patientId } }}
            onRerun={() =>
              rerun.mutate(patientId, {
                onSuccess: ({ runId }) =>
                  toastMatchingStarted(
                    () => void navigate({ to: "/matches", search: { runId } })
                  ),
              })
            }
            rerunPending={rerun.isPending}
            deletePending={del.isPending}
            onDelete={async () => {
              await del.mutateAsync(patientId)
              toast.add({ title: "Patient deleted" })
              void navigate({ to: "/patients" })
            }}
          />
        }
      />
      <section className="mb-6 border p-4">
        <h2 className="mb-3 text-lg font-semibold">
          Match results involving this patient
        </h2>
        {matches.isPending ? (
          <p className="text-sm text-muted-foreground">Loading match results…</p>
        ) : evaluations.length ? (
          <ul className="space-y-2">
            {evaluations.map((e) => (
              <li key={e.id}>
                <Link
                  className="underline"
                  to="/matches/$matchId"
                  params={{ matchId: e.id }}
                >
                  {e.donorCode} |{" "}
                  <time dateTime={e.createdAt} suppressHydrationWarning>
                    {new Date(e.createdAt).toLocaleDateString()}
                  </time>
                </Link>{" "}
                <StatusBadge status={e.overall} />
                {e.outOfDate && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    Out of date
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p>
            No match results yet. Choose Check against a donor to compare a
            pair.
          </p>
        )}
      </section>
      <PatientSummary patient={p} />
    </>
  )
}
