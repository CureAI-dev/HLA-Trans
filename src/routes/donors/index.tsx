import { Link, createFileRoute } from "@tanstack/react-router"
import { useDb } from "@/lib/storage/db"
import { PageHeader } from "@/components/app/page-header"
import { DonorTable } from "@/components/donor/donor-table"

export const Route = createFileRoute("/donors/")({ component: Donors })
function Donors() {
  return (
    <>
      <PageHeader
        title="Donors"
        description="Manage donor records and screen active candidates."
        actions={
          <Link className="border px-3 py-2" to="/donors/new">
            Add donor
          </Link>
        }
      />
      <DonorTable donors={useDb().donors} />
    </>
  )
}
