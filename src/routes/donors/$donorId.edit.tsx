import { Link, createFileRoute } from "@tanstack/react-router"
import { useDb } from "@/lib/storage/db"
import { DonorForm } from "@/components/donor/donor-form"
import { PageHeader } from "@/components/app/page-header"

export const Route = createFileRoute("/donors/$donorId/edit")({
  component: EditDonor,
})
function EditDonor() {
  const { donorId } = Route.useParams()
  const donor = useDb().donors.find((d) => d.id === donorId)
  return donor ? (
    <>
      <PageHeader title="Edit donor" />
      <DonorForm key={donor.id} initial={donor} />
    </>
  ) : (
    <p>
      Donor not found. <Link to="/donors">Return to donors</Link>
    </p>
  )
}
