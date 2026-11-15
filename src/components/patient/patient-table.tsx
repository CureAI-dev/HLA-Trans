import { useState } from "react"
import { Link } from "@tanstack/react-router"
import type { Patient } from "@/domain/schema"
import { patientAge } from "@/domain/calc"
import {
  ABO,
  CANDIDATE_STATE,
  URGENCY_STATUS,
  MCS_DEVICE,
  labelOf,
} from "@/domain/options"
import { TextField, SelectField } from "@/components/form"

export function PatientTable({ patients }: { patients: Patient[] }) {
  const [search, setSearch] = useState("")
  const [state, setState] = useState("")
  const [abo, setAbo] = useState("")
  const [sort, setSort] = useState("name")
  const rows = patients
    .filter(
      (p) =>
        `${p.identity.firstName} ${p.identity.lastName} ${p.identity.mrn}`
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (!state || p.listing.state === state) &&
        (!abo || p.blood.abo === abo)
    )
    .sort((a, b) =>
      sort === "listed"
        ? b.listing.listingDate.localeCompare(a.listing.listingDate)
        : `${a.identity.lastName} ${a.identity.firstName}`.localeCompare(
            `${b.identity.lastName} ${b.identity.firstName}`
          )
    )
  return (
    <>
      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        <TextField
          label="Search name or MRN"
          value={search}
          onChange={setSearch}
        />
        <SelectField
          label="Listing state"
          value={state}
          onChange={setState}
          options={[{ value: "", label: "All states" }, ...CANDIDATE_STATE]}
        />
        <SelectField
          label="Blood group"
          value={abo}
          onChange={setAbo}
          options={[{ value: "", label: "All blood groups" }, ...ABO]}
        />
        <SelectField
          label="Sort patients"
          value={sort}
          onChange={setSort}
          options={[
            { value: "name", label: "Name A-Z" },
            { value: "listed", label: "Most recently listed" },
          ]}
        />
      </div>
      {rows.length ? (
        <div className="overflow-x-auto border">
          <table className="w-full text-left text-sm">
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
                  <th key={x} className="p-3">
                    {x}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="p-3">
                    <Link
                      className="font-medium underline"
                      to="/patients/$patientId"
                      params={{ patientId: p.id }}
                    >
                      {p.identity.firstName} {p.identity.lastName}
                    </Link>
                  </td>
                  <td className="p-3">{p.identity.mrn}</td>
                  <td className="p-3">{patientAge(p) ?? "Not recorded"}</td>
                  <td className="p-3">{p.blood.abo ?? "Not recorded"}</td>
                  <td className="p-3">
                    {labelOf(CANDIDATE_STATE, p.listing.state)}
                    <br />
                    {labelOf(URGENCY_STATUS, p.listing.urgencyStatus)}
                  </td>
                  <td className="p-3">
                    {p.sensitization.cpra ?? "Not recorded"}
                  </td>
                  <td className="p-3">
                    {labelOf(MCS_DEVICE, p.support.device)}
                  </td>
                  <td className="p-3">
                    {p.listing.listingDate || "Not recorded"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border p-8 text-center">
          <h2 className="font-semibold">No patients match these filters</h2>
          <p>
            Change your search or clear the listing state and blood group
            filters.
          </p>
        </div>
      )}
    </>
  )
}
