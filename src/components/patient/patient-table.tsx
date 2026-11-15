import { Link } from "@tanstack/react-router"
import { Users } from "lucide-react"
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

export function PatientTable({ page }: { page: Page<PatientRow> }) {
  if (!page.items.length)
    return (
      <EmptyState
        icon={<Users />}
        title="No patients found"
        description="Add a candidate to begin checking compatibility, or load the demo dataset from the Data page."
        action={
          <Link className="underline" to="/patients/new">
            Add patient
          </Link>
        }
      />
    )
  return (
    <div className="overflow-x-auto border">
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
    </div>
  )
}
