import { useState } from "react"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { patientQueries } from "@/features/patients/patients.queries"
import { useDeletePatient } from "@/features/patients/patients.mutations"
import { matchQueries } from "@/features/matches/matches.queries"
import { ensureOrNotFound } from "@/lib/route-helpers"
import { PatientSummary } from "@/components/patient/patient-summary"
import { PageHeader } from "@/components/app/page-header"
import { StatusBadge } from "@/components/app/status"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog"

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
  const navigate = useNavigate()
  const [error, setError] = useState("")
  const evaluations = matches.data?.items ?? []
  function remove() {
    setError("")
    del.mutate(patientId, {
      onSuccess: () => {
        toast.add({ title: "Patient deleted" })
        void navigate({ to: "/patients" })
      },
      onError: (e) =>
        setError(e instanceof Error ? e.message : "Unable to delete patient"),
    })
  }
  return (
    <>
      <PageHeader
        title={`${p.identity.firstName} ${p.identity.lastName}`}
        description={`MRN ${p.identity.mrn}`}
        actions={
          <>
            <Link
              className="border px-3 py-2"
              to="/patients/$patientId/edit"
              params={{ patientId: p.id }}
            >
              Edit patient
            </Link>
            <Link
              className="border bg-primary px-3 py-2 text-primary-foreground"
              to="/matches/check"
              search={{ patientId: p.id }}
            >
              Check against a donor
            </Link>
            <AlertDialog>
              <AlertDialogTrigger render={<Button variant="outline" />}>
                Delete patient
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this patient?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The candidate record will be deleted. Existing saved match
                    results remain available.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={remove}>
                    Delete patient
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        }
      />
      {error && <p role="alert">{error}</p>}
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
