import { useState } from "react"
import type { Donor } from "@/domain/schema"
import { ABO, DONOR_STATE, labelOf } from "@/domain/options"
import { TextField, SelectField } from "@/components/form"

export function DonorTable({ donors }: { donors: ReadonlyArray<Donor> }) {
  const [search, setSearch] = useState("")
  const [state, setState] = useState("")
  const [abo, setAbo] = useState("")
  const [sort, setSort] = useState("updated")
  const rows = donors
    .filter(
      (d) =>
        `${d.identity.donorId} ${d.identity.donorHospital} ${d.identity.opo}`
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (!state || d.identity.state === state) &&
        (!abo || d.blood.abo === abo)
    )
    .sort((a, b) =>
      sort === "id"
        ? a.identity.donorId.localeCompare(b.identity.donorId)
        : b.updatedAt.localeCompare(a.updatedAt)
    )
  return (
    <section className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TextField
          label="Search donors"
          value={search}
          onChange={setSearch}
          placeholder="Donor ID, hospital or OPO"
        />
        <SelectField
          label="State"
          value={state}
          onChange={setState}
          options={[{ value: "", label: "All states" }, ...DONOR_STATE]}
        />
        <SelectField
          label="ABO"
          value={abo}
          onChange={setAbo}
          options={[{ value: "", label: "All blood types" }, ...ABO]}
        />
        <SelectField
          label="Sort donors"
          value={sort}
          onChange={setSort}
          options={[
            { value: "updated", label: "Recently updated" },
            { value: "id", label: "Donor ID" },
          ]}
        />
      </div>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Donor records</caption>
            <thead>
              <tr>
                {[
                  "Donor ID",
                  "State",
                  "Hospital / OPO",
                  "Age (years)",
                  "ABO",
                  "Donation",
                  "Weight (kg)",
                  "LVEF (%)",
                  "Updated",
                ].map((h) => (
                  <th className="border-b p-3 text-left" key={h}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id}>
                  <td className="p-3">
                    <a className="underline" href={`/donors/${d.id}`}>
                      {d.identity.donorId}
                    </a>
                  </td>
                  <td className="p-3">
                    {labelOf(DONOR_STATE, d.identity.state)}
                  </td>
                  <td className="p-3">
                    {d.identity.donorHospital || "Not recorded"}
                    <p className="text-xs">{d.identity.opo}</p>
                  </td>
                  <td className="p-3">
                    {d.identity.ageYears ?? "Not recorded"}
                  </td>
                  <td className="p-3">{d.blood.abo ?? "Not recorded"}</td>
                  <td className="p-3">{d.donation.type.toUpperCase()}</td>
                  <td className="p-3">{d.body.weightKg ?? "Not recorded"}</td>
                  <td className="p-3">
                    {d.echo.repeatLvef ?? d.echo.lvef ?? "Not recorded"}
                  </td>
                  <td className="p-3">
                    {new Date(d.updatedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border p-8">
          <p>
            {donors.length
              ? "No donors match these filters. Adjust the search or filters."
              : "No donors recorded yet."}
          </p>
          <a href="/donors/new" className="underline">
            Add donor
          </a>
        </div>
      )}
    </section>
  )
}
