import { Link } from "@tanstack/react-router"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Plus, Users } from "lucide-react"
import type { PatientRow } from "@/domain/match-types"
import type { Page } from "@/lib/cursor"
import { ageInYears } from "@/domain/calc"
import {
  CANDIDATE_STATE,
  MCS_DEVICE,
  URGENCY_STATUS,
  labelOf,
} from "@/domain/options"
import { EmptyState } from "@/components/app/empty-state"
import { Button } from "@/components/ui/button"

export function PatientTable({
  page,
  filtered = false,
}: {
  page: Page<PatientRow>
  filtered?: boolean
}) {
  if (!page.items.length)
    return filtered ? (
      <EmptyState
        icon={<Users />}
        title="No patients match these filters"
        description="Change the search or reset the filters to see more candidates."
      />
    ) : (
      <EmptyState
        icon={<Users />}
        title="No patients yet"
        description="Add a candidate to begin checking compatibility, or load the synthetic demo dataset."
        action={
          <>
            <Button nativeButton={false} render={<Link to="/patients/new" />}>
              <Plus aria-hidden="true" />
              Add patient
            </Button>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link to="/data" />}
            >
              Load demo dataset
            </Button>
          </>
        }
      />
    )
  return (
    <ScrollArea orientation="horizontal" className="border">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Patient records</caption>
        <thead className="bg-muted">
          <tr>
            {[
              "Name",
              "MRN",
              "Age (years)",
              "ABO",
              "Status",
              "cPRA (%)",
              "Device",
              "Listed date",
            ].map((x) => (
              <th key={x} scope="col" className="p-3">
                {x}
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
                  to="/patients/$patientId"
                  params={{ patientId: row.id }}
                >
                  {row.fullName}
                </Link>
              </td>
              <td className="p-3">{row.mrn}</td>
              <td className="p-3">
                {ageInYears(row.dateOfBirth) ?? "Not recorded"}
              </td>
              <td className="p-3">{row.abo ?? "Not recorded"}</td>
              <td className="p-3">
                {labelOf(CANDIDATE_STATE, row.listingState)}
                <br />
                {labelOf(URGENCY_STATUS, row.urgencyStatus)}
              </td>
              <td className="p-3">{row.cpra ?? "Not recorded"}</td>
              <td className="p-3">{labelOf<string>(MCS_DEVICE, row.device)}</td>
              <td className="p-3">{row.listingDate || "Not recorded"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollArea>
  )
}
