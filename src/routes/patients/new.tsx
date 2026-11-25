import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { emptyPatient } from "@/domain/factories"
import { PatientForm } from "@/components/patient/patient-form"
import { PracticeBanner } from "@/features/guide/components/practice-banner"
import { PageHeader } from "@/components/app/page-header"
import { FormPageSkeleton } from "@/components/app/page-skeletons"

export const Route = createFileRoute("/patients/new")({
  validateSearch: z.object({
    /** Tutorial: nothing is saved. */
    practice: z.boolean().optional().catch(undefined),
  }),
  pendingComponent: FormPageSkeleton,
  component: NewPatient,
})
function NewPatient() {
  const { practice = false } = Route.useSearch()
  const [patient] = useState(() => emptyPatient())
  return (
    <>
      {practice && <PracticeBanner />}
      <PageHeader
        title="Add patient"
        description="Record candidate information. Blank measurements remain not recorded."
      />
      <PatientForm
        key={String(practice)}
        initial={patient}
        practice={practice}
      />
    </>
  )
}
