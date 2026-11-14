import { createFileRoute } from "@tanstack/react-router"
import { useDb } from "@/lib/storage/db"
import { PatientForm } from "@/components/patient/patient-form"
import { PageHeader } from "@/components/app/page-header"

export const Route = createFileRoute("/patients/$patientId/edit")({
  component: EditPatient,
})
function EditPatient() {
  const { patientId } = Route.useParams()
  const patient = useDb().patients.find((p) => p.id === patientId)
  return patient ? (
    <>
      <PageHeader title="Edit patient" />
      <PatientForm key={patient.id} initial={patient} />
    </>
  ) : (
    <p>
      Patient not found. <a href="/patients">Return to patients</a>
    </p>
  )
}
