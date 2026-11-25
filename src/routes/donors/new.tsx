import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { emptyDonor } from "@/domain/factories"
import { DonorForm } from "@/components/donor/donor-form"
import { PracticeBanner } from "@/features/guide/components/practice-banner"
import { PageHeader } from "@/components/app/page-header"
import { FormPageSkeleton } from "@/components/app/page-skeletons"

export const Route = createFileRoute("/donors/new")({
  validateSearch: z.object({
    /** Tutorial: nothing is saved. */
    practice: z.boolean().optional().catch(undefined),
  }),
  pendingComponent: FormPageSkeleton,
  component: NewDonor,
})
function NewDonor() {
  const { practice = false } = Route.useSearch()
  const [donor] = useState(() => emptyDonor())
  return (
    <>
      {practice && <PracticeBanner />}
      <PageHeader
        title="Add donor"
        description="Record donor information. Blank measurements remain not recorded."
      />
      <DonorForm key={String(practice)} initial={donor} practice={practice} />
    </>
  )
}
