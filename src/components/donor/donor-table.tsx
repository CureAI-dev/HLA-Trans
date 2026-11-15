import { Link } from "@tanstack/react-router"
import { HeartPulse, Plus } from "lucide-react"
import type { DonorRow } from "@/domain/match-types"
import type { Page } from "@/lib/cursor"
import { DONATION_TYPE, DONOR_STATE, labelOf } from "@/domain/options"
import { EmptyState } from "@/components/app/empty-state"
import { Button } from "@/components/ui/button"

export function DonorTable({
  page,
  filtered = false,
}: {
  page: Page<DonorRow>
  filtered?: boolean
}) {
  if (!page.items.length)
    return filtered ? (
      <EmptyState
        icon={<HeartPulse />}
        title="No donors match these filters"
        description="Change the search or reset the filters to see more donors."
      />
    ) : (
      <EmptyState
        icon={<HeartPulse />}
        title="No donors yet"
        description="Add a donor to screen it against active candidates, or load the synthetic demo dataset."
        action={
          <>
            <Button nativeButton={false} render={<Link to="/donors/new" />}>
              <Plus aria-hidden="true" />
              Add donor
            </Button>
            <Button variant="outline" nativeButton={false} render={<Link to="/data" />}>
              Load demo dataset
            </Button>
          </>
        }
      />
    )
  return (
    <div className="overflow-x-auto border">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Donor records</caption>
        <thead className="bg-muted">
          <tr>
            {[
              "Donor ID",
              "State",
              "Hospital",
              "Age (years)",
              "ABO",
              "Donation",
              "Updated",
            ].map((h) => (
              <th key={h} scope="col" className="p-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {page.items.map((row) => (
            <tr key={row.id} className="border-t">
              <td className="p-3">
                <Link
                  className="font-medium underline"
                  to="/donors/$donorId"
                  params={{ donorId: row.id }}
                >
                  {row.donorCode}
                </Link>
              </td>
              <td className="p-3">{labelOf(DONOR_STATE, row.state)}</td>
              <td className="p-3">{row.hospital || "Not recorded"}</td>
              <td className="p-3">{row.ageYears ?? "Not recorded"}</td>
              <td className="p-3">{row.abo ?? "Not recorded"}</td>
              <td className="p-3" title={labelOf(DONATION_TYPE, row.donationType)}>
                {row.donationType.toUpperCase()}
              </td>
              <td className="p-3">
                <time dateTime={row.updatedAt} suppressHydrationWarning>
                  {new Date(row.updatedAt).toLocaleDateString()}
                </time>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
