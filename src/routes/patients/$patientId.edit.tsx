import { createFileRoute } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import { patientQueries } from "@/features/patients/patients.queries"
import { ensureOrNotFound } from "@/lib/route-helpers"
import { PatientForm } from "@/components/patient/patient-form"
import { PageHeader } from "@/components/app/page-header"
import { FormPageSkeleton } from "@/components/app/page-skeletons"

export const Route = createFileRoute("/patients/$patientId/edit")({
  loader: ({ context, params }) =>
    ensureOrNotFound(
      context.queryClient.ensureQueryData(
        patientQueries.detail(params.patientId)
      )
    ),
  head: () => ({ meta: [{ title: "Edit patient · HLA-Trans" }] }),
  pendingComponent: FormPageSkeleton,
  component: EditPatient,
})

function EditPatient() {
  const { patientId } = Route.useParams()
  const { data } = useSuspenseQuery(patientQueries.detail(patientId))
  return (
    <>
      <PageHeader title="Edit patient" />
      <PatientForm
        key={data.record.id}
        initial={data.record}
        version={data.version}
      />
    </>
  )
}
