import type { Donor, Patient } from "@/domain/schema"
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox"

function Picker({
  label,
  items,
  value,
  onChange,
}: {
  label: string
  items: Array<{ value: string; label: string }>
  value: string
  onChange: (id: string) => void
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={`pick-${label}`}>{label}</label>
      <Combobox
        items={items}
        value={items.find((item) => item.value === value) ?? null}
        onValueChange={(item) => onChange(item?.value ?? "")}
        itemToStringLabel={(item) => item.label}
      >
        <ComboboxInput
          id={`pick-${label}`}
          placeholder={`Search ${label.toLowerCase()}`}
          showClear
        />
        <ComboboxContent>
          <ComboboxEmpty>No matching records</ComboboxEmpty>
          <ComboboxList>
            {(item: { value: string; label: string }) => (
              <ComboboxItem key={item.value} value={item}>
                {item.label}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  )
}
export function PairPicker({
  patients,
  donors,
  patientId,
  donorId,
  onPatientChange,
  onDonorChange,
}: {
  patients: Patient[]
  donors: Donor[]
  patientId: string
  donorId: string
  onPatientChange: (id: string) => void
  onDonorChange: (id: string) => void
}) {
  return (
    <section id="pair-picker" className="grid gap-4 border p-4 md:grid-cols-2">
      <Picker
        label="Patient"
        value={patientId}
        onChange={onPatientChange}
        items={patients.map((p) => ({
          value: p.id,
          label: `${p.identity.firstName} ${p.identity.lastName}  /  ${p.identity.mrn}`,
        }))}
      />
      <Picker
        label="Donor"
        value={donorId}
        onChange={onDonorChange}
        items={donors.map((d) => ({
          value: d.id,
          label: `${d.identity.donorId}  /  ${d.blood.abo ?? "Unknown ABO"}`,
        }))}
      />
    </section>
  )
}
