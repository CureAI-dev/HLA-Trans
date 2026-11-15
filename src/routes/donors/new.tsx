import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { emptyDonor } from "@/domain/factories"
import { DonorForm } from "@/components/donor/donor-form"
import { PageHeader } from "@/components/app/page-header"
import { FormPageSkeleton } from "@/components/app/page-skeletons"

export const Route = createFileRoute("/donors/new")({
  pendingComponent: FormPageSkeleton,
  component: NewDonor,
})
function NewDonor() {
  const [donor] = useState(() => emptyDonor())
  return (
    <>
      <PageHeader
        title="Add donor"
        description="Record donor information. Blank measurements remain not recorded."
      />
      <DonorForm initial={donor} />
    </>
  )
}
