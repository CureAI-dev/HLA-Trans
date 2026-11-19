import { createFileRoute } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import { donorQueries } from "@/features/donors/donors.queries"
import { ensureOrNotFound } from "@/lib/route-helpers"
import { DonorForm } from "@/components/donor/donor-form"
import { PageHeader } from "@/components/app/page-header"
import { FormPageSkeleton } from "@/components/app/page-skeletons"

export const Route = createFileRoute("/donors/$donorId/edit")({
  loader: ({ context, params }) =>
    ensureOrNotFound(
      context.queryClient.ensureQueryData(donorQueries.detail(params.donorId))
    ),
  head: () => ({ meta: [{ title: "Edit donor · Concord" }] }),
  pendingComponent: FormPageSkeleton,
  component: EditDonor,
})

function EditDonor() {
  const { donorId } = Route.useParams()
  const { data } = useSuspenseQuery(donorQueries.detail(donorId))
  return (
    <>
      <PageHeader title="Edit donor" />
      <DonorForm
        key={data.record.id}
        initial={data.record}
        version={data.version}
      />
    </>
  )
}
