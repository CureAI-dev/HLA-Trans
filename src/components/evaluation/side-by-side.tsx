import type { Patient, Donor } from "@/domain/schema"

export function SideBySide({
  patient,
  donor,
}: {
  patient: Patient
  donor: Donor
}) {
  const rows = [
    [
      "Identifier",
      `${patient.identity.firstName} ${patient.identity.lastName} (${patient.identity.mrn})`,
      donor.identity.donorId,
    ],
    ["ABO", patient.blood.abo, donor.blood.abo],
    ["Sex", patient.identity.sex, donor.identity.sex],
    ["Height (cm)", patient.body.heightCm, donor.body.heightCm],
    ["Weight (kg)", patient.body.weightKg, donor.body.weightKg],
    ["State", patient.listing.state, donor.identity.state],
  ]
  return (
    <section className="overflow-x-auto border p-4">
      <h2 className="mb-3 text-lg font-semibold">Side-by-side comparison</h2>
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            <th>Measure</th>
            <th>Patient</th>
            <th>Donor</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, p, d]) => (
            <tr className="border-t" key={label}>
              <th className="p-2">{label}</th>
              <td className="p-2">{p ?? "Not recorded"}</td>
              <td className="p-2">{d ?? "Not recorded"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
