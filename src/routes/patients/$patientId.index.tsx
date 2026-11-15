import { useState } from "react"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { actions, useDb } from "@/lib/storage/db"
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
  component: PatientDetail,
})
function PatientDetail() {
  const { patientId } = Route.useParams()
  const db = useDb()
  const p = db.patients.find((x) => x.id === patientId)
  const navigate = useNavigate()
  const [error, setError] = useState("")
  if (!p)
    return (
      <p>
        Patient not found. <Link to="/patients">Return to patients</Link>
      </p>
    )
  const evaluations = db.evaluations.filter((e) => e.patientId === p.id)
  function remove() {
    try {
      actions.deletePatient(patientId)
      toast.add({ title: "Patient deleted" })
      void navigate({ to: "/patients" })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to delete patient")
    }
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
        {evaluations.length ? (
          <ul className="space-y-2">
            {evaluations.map((e) => (
              <li key={e.id}>
                <Link
                  className="underline"
                  to="/matches/$matchId"
                  params={{ matchId: e.id }}
                >
                  {e.donorSnapshot.identity.donorId} |{" "}
                  {new Date(e.createdAt).toLocaleDateString()}
                </Link>{" "}
                <StatusBadge status={e.result.overall} />
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
