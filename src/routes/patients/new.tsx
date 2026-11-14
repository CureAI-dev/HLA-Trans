import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { emptyPatient } from "@/domain/factories"
import { PatientForm } from "@/components/patient/patient-form"
import { PageHeader } from "@/components/app/page-header"

export const Route = createFileRoute("/patients/new")({ component: NewPatient })
function NewPatient() {
  const [patient] = useState(() => emptyPatient())
  return (
    <>
      <PageHeader
        title="Add patient"
        description="Record candidate information. Blank measurements remain not recorded."
      />
      <PatientForm initial={patient} />
    </>
  )
}
