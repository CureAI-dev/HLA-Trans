import { useEffect, useState } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import type { Donor, Patient } from "@/domain/schema"
import { patientQueries } from "@/features/patients/patients.queries"
import { donorQueries } from "@/features/donors/donors.queries"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"

type Item = { value: string; label: string }

/** Delays the value so typing does not send a request per keystroke. */
function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return debounced
}

export const patientLabel = (p: Patient): string =>
  `${p.identity.firstName} ${p.identity.lastName} · ${p.identity.mrn}`.trim()
export const donorLabel = (d: Donor): string =>
  `${d.identity.donorId} · ${d.blood.abo ?? "Unknown ABO"}`

function Picker({
  label,
  selected,
  items,
  loading,
  onChange,
  onQuery,
}: {
  label: string
  selected: Item | null
  items: Item[]
  loading: boolean
  onChange: (item: Item | null) => void
  onQuery: (q: string) => void
}) {
  // The selected record must stay in the list so the Combobox can render its label.
  const all =
    selected && !items.some((item) => item.value === selected.value)
      ? [selected, ...items]
      : items
  return (
    <div className="space-y-2">
      <label htmlFor={`pick-${label}`}>{label}</label>
      <Combobox
        items={all}
        filter={null} // the server filters
        value={selected}
        onValueChange={(item) => onChange(item ?? null)}
        onInputValueChange={(q) => onQuery(q === selected?.label ? "" : q)}
        itemToStringLabel={(item) => item.label}
        isItemEqualToValue={(a, b) => a.value === b.value}
      >
        <ComboboxInput
          id={`pick-${label}`}
          placeholder={`Search ${label.toLowerCase()}`}
          showClear
        />
        <ComboboxContent>
          <ComboboxEmpty>
            {loading ? "Searching…" : "No matching records"}
          </ComboboxEmpty>
          <ComboboxList>
            {(item: Item) => (
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

/** Label for the current selection: the loaded record, else the item just picked, else a placeholder. */
function selection(
  id: string,
  record: Item | null,
  picked: Item | null
): Item | null {
  if (!id) return null
  if (record?.value === id) return record
  if (picked?.value === id) return picked
  return { value: id, label: "Loading…" }
}

export function PairPicker({
  patientId,
  donorId,
  patient,
  donor,
  onPatientChange,
  onDonorChange,
}: {
  patientId: string
  donorId: string
  /** Loaded records for the selection (null while none or still loading). */
  patient: Patient | null
  donor: Donor | null
  onPatientChange: (id: string) => void
  onDonorChange: (id: string) => void
}) {
  const [pickedPatient, setPickedPatient] = useState<Item | null>(null)
  const [pickedDonor, setPickedDonor] = useState<Item | null>(null)
  const [patientQ, setPatientQ] = useState("")
  const [donorQ, setDonorQ] = useState("")
  const pq = useDebounced(patientQ.trim().slice(0, 100), 200)
  const dq = useDebounced(donorQ.trim().slice(0, 100), 200)
  const patients = useQuery({
    ...patientQueries.list({ q: pq || undefined, sort: "name" }),
    placeholderData: keepPreviousData,
  })
  const donors = useQuery({
    ...donorQueries.list({ q: dq || undefined, sort: "code" }),
    placeholderData: keepPreviousData,
  })
  return (
    <section id="pair-picker" className="grid gap-4 border p-4 md:grid-cols-2">
      <Picker
        label="Patient"
        selected={selection(
          patientId,
          patient ? { value: patient.id, label: patientLabel(patient) } : null,
          pickedPatient
        )}
        items={(patients.data?.items ?? []).map((row) => ({
          value: row.id,
          label: `${row.fullName} · ${row.mrn}`,
        }))}
        loading={patients.isFetching}
        onChange={(item) => {
          setPickedPatient(item)
          onPatientChange(item?.value ?? "")
        }}
        onQuery={setPatientQ}
      />
      <Picker
        label="Donor"
        selected={selection(
          donorId,
          donor ? { value: donor.id, label: donorLabel(donor) } : null,
          pickedDonor
        )}
        items={(donors.data?.items ?? []).map((row) => ({
          value: row.id,
          label: `${row.donorCode} · ${row.abo ?? "Unknown ABO"}`,
        }))}
        loading={donors.isFetching}
        onChange={(item) => {
          setPickedDonor(item)
          onDonorChange(item?.value ?? "")
        }}
        onQuery={setDonorQ}
      />
    </section>
  )
}
