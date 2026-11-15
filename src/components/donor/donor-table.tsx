import { Link } from "@tanstack/react-router"
import { HeartPulse } from "lucide-react"
import type { DonorRow } from "@/domain/match-types"
import type { Page } from "@/lib/cursor"
import { DONOR_STATE, labelOf } from "@/domain/options"
import { EmptyState } from "@/components/app/empty-state"

export function DonorTable({ page }: { page: Page<DonorRow> }) {
  if (!page.items.length)
    return (
      <EmptyState
        icon={<HeartPulse />}
        title="No donors found"
        description="Add a donor to screen it against active candidates."
        action={
          <Link className="underline" to="/donors/new">
            Add donor
          </Link>
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
              <td className="p-3">{row.donationType.toUpperCase()}</td>
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
