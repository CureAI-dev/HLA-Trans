import { useState } from "react"
import type { Antibody } from "@/domain/schema"
import { C1Q } from "@/domain/options"
import { Button } from "@/components/ui/button"
import { TextField } from "./text-field"
import { NumberField } from "./number-field"
import { SelectField } from "./select-field"
import { DateField } from "./date-field"
import { parseAntibodyPaste } from "./form-helpers"

export { parseAntibodyPaste } from "./form-helpers"
export interface AntibodyTableProps {
  value: Antibody[]
  onChange: (value: Antibody[]) => void
  errors?: Record<string, string>
}
export function AntibodyTable({ value, onChange, errors }: AntibodyTableProps) {
  const [draftAntigen, setDraftAntigen] = useState("")
  const [draftMfi, setDraftMfi] = useState<number | null>(null)
  const [paste, setPaste] = useState("")
  const [invalid, setInvalid] = useState<string[]>([])
  const update = (index: number, patch: Partial<Antibody>) =>
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <TextField
          label="Paste antibodies"
          hint="Example: A2 8000, B44:3500; DQ7 1200"
          value={paste}
          onChange={setPaste}
          error={
            invalid.length
              ? `Invalid entries: ${invalid.join("; ")}`
              : undefined
          }
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            const parsed = parseAntibodyPaste(paste)
            onChange([
              ...value,
              ...parsed.rows.map((row) => ({
                ...row,
                id: crypto.randomUUID(),
              })),
            ])
            setInvalid(parsed.invalidTokens)
            setPaste(parsed.invalidTokens.join("; "))
          }}
        >
          Import rows
        </Button>
      </div>
      {value.map((row, index) => (
        <fieldset
          key={row.id}
          className="grid gap-3 border p-3 sm:grid-cols-2 lg:grid-cols-5"
        >
          <legend className="px-1 text-sm">Antibody {index + 1}</legend>
          <TextField
            label="Antigen"
            value={row.antigen}
            onChange={(antigen) => update(index, { antigen })}
            error={errors?.[`${index}.antigen`]}
          />
          <NumberField
            label="MFI"
            unit="MFI"
            min={0}
            max={100000}
            value={row.mfi}
            onChange={(mfi) => {
              if (mfi !== null) update(index, { mfi })
            }}
            error={errors?.[`${index}.mfi`]}
            hint="Required; enter a measured MFI."
          />
          <SelectField
            label="C1q"
            value={row.c1q}
            error={errors?.[`${index}.c1q`]}
            options={C1Q}
            onChange={(c1q) => update(index, { c1q })}
          />
          <DateField
            label="Test date"
            disableFuture
            value={row.testDate}
            error={errors?.[`${index}.testDate`]}
            onChange={(testDate) => update(index, { testDate })}
          />
          <Button
            type="button"
            variant="outline"
            aria-label={`Remove antibody ${index + 1}`}
            onClick={() => onChange(value.filter((_, i) => i !== index))}
          >
            Remove
          </Button>
        </fieldset>
      ))}
      <fieldset className="grid gap-3 border p-3 sm:grid-cols-3">
        <legend>New antibody</legend>
        <TextField
          label="New antigen"
          value={draftAntigen}
          onChange={setDraftAntigen}
        />
        <NumberField
          label="New MFI"
          unit="MFI"
          value={draftMfi}
          onChange={setDraftMfi}
          min={0}
          max={100000}
        />
        <Button
          type="button"
          variant="outline"
          disabled={
            !draftAntigen.trim() ||
            draftMfi === null ||
            draftMfi < 0 ||
            draftMfi > 100000
          }
          onClick={() => {
            if (draftMfi === null) return
            onChange([
              ...value,
              {
                id: crypto.randomUUID(),
                antigen: draftAntigen.trim(),
                mfi: draftMfi,
                c1q: "not_done",
                testDate: "",
              },
            ])
            setDraftAntigen("")
            setDraftMfi(null)
          }}
        >
          Add antibody
        </Button>
      </fieldset>
    </div>
  )
}
