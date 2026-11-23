import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Search } from "lucide-react"
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
import { InputGroupAddon, InputGroupButton } from "@/components/ui/input-group"

type Item = { value: string; label: string }

export const patientLabel = (p: Patient): string =>
  `${p.identity.firstName} ${p.identity.lastName} · ${p.identity.mrn}`.trim()
export const donorLabel = (d: Donor): string =>
  `${d.identity.donorId} · ${d.blood.abo ?? "Unknown ABO"}`

function Picker({
  label,
  selected: current,
  items,
  loading,
  query,
  onChange,
  onQuery,
}: {
  label: string
  selected: Item | null
  items: Item[]
  loading: boolean
  /** The submitted search, "" for the unfiltered list. */
  query: string
  onChange: (item: Item | null) => void
  onQuery: (q: string) => void
}) {
  // Same object while the selection is unchanged: Base UI overwrites the typed text
  // with the selected label whenever the value's identity changes.
  const id = current?.value
  const name = current?.label
  const selected = useMemo(
    () =>
      id === undefined || name === undefined
        ? null
        : { value: id, label: name },
    [id, name]
  )
  // Browsing keeps the selected record in the list; a search shows only its matches.
  const all =
    !query && selected && !items.some((item) => item.value === selected.value)
      ? [selected, ...items]
      : items
  const [draft, setDraft] = useState("")
  const text = draft.trim().slice(0, 100)
  // Text not searched yet: hide the old results so they can't pass for matches.
  const unsent = text !== query
  const submit = () => onQuery(text)
  return (
    <div className="space-y-2">
      <label htmlFor={`pick-${label}`}>{label}</label>
      <Combobox
        items={unsent ? [] : all}
        filter={null} // the server filters
        value={selected}
        onValueChange={(item) => onChange(item ?? null)}
        onInputValueChange={(value, { reason }) => {
          // Other reasons (pick, clear, close) put the selection's label or "" back.
          const typed = reason === "input-change" ? value : ""
          setDraft(typed)
          if (!typed.trim()) onQuery("")
        }}
        onOpenChange={(open, details) => {
          // The search button is outside the popup, but pressing it must keep the text.
          const target = details.event.target
          if (
            !open &&
            target instanceof Element &&
            target.closest("[data-search-button]")
          )
            details.cancel()
        }}
        itemToStringLabel={(item) => item.label}
        isItemEqualToValue={(a, b) => a.value === b.value}
      >
        <ComboboxInput
          id={`pick-${label}`}
          placeholder={`Search ${label.toLowerCase()}`}
          enterKeyHint="search"
          onKeyDown={(e) => {
            if (
              e.key !== "Enter" ||
              e.nativeEvent.isComposing ||
              !text ||
              // An option is highlighted: Enter picks it.
              e.currentTarget.getAttribute("aria-activedescendant")
            )
              return
            e.preventDefault()
            e.preventBaseUIHandler()
            submit()
          }}
          showClear
        >
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              data-search-button=""
              size="icon-xs"
              aria-label={`Search ${label.toLowerCase()}`}
              tabIndex={-1} // moving focus here would close the list; Enter does the same
              onMouseDown={(e) => e.preventDefault()}
              onClick={submit}
            >
              <Search aria-hidden="true" />
            </InputGroupButton>
          </InputGroupAddon>
        </ComboboxInput>
        <ComboboxContent>
          <ComboboxEmpty>
            {unsent
              ? "Press Enter to search"
              : loading
                ? "Searching…"
                : "No matching records"}
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
  const patients = useQuery(
    patientQueries.list({ q: patientQ || undefined, sort: "name" })
  )
  const donors = useQuery(
    donorQueries.list({ q: donorQ || undefined, sort: "code" })
  )
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
        query={patientQ}
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
        query={donorQ}
        onChange={(item) => {
          setPickedDonor(item)
          onDonorChange(item?.value ?? "")
        }}
        onQuery={setDonorQ}
      />
    </section>
  )
}
