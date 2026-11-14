import type { Vasoactive } from "@/domain/schema"
import { INOTROPE_AGENT, INOTROPE_UNIT } from "@/domain/options"
import { Button } from "@/components/ui/button"
import { SelectField } from "./select-field"
import { NumberField } from "./number-field"

export interface VasoactiveListProps {
  value: Vasoactive[]
  onChange: (value: Vasoactive[]) => void
  errors?: Record<string, string>
}
export function VasoactiveList({
  value,
  onChange,
  errors,
}: VasoactiveListProps) {
  const update = (index: number, patch: Partial<Vasoactive>) =>
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  return (
    <div className="space-y-3">
      {value.map((row, index) => (
        <fieldset key={row.id} className="grid gap-3 border p-3 sm:grid-cols-3">
          <legend className="text-sm">Vasoactive {index + 1}</legend>
          <SelectField
            label="Agent"
            value={row.agent}
            error={errors?.[`${index}.agent`]}
            options={INOTROPE_AGENT}
            onChange={(agent) => update(index, { agent, dose: null })}
          />
          <NumberField
            label="Dose"
            unit={INOTROPE_UNIT[row.agent]}
            value={row.dose}
            min={0}
            error={errors?.[`${index}.dose`]}
            onChange={(dose) => update(index, { dose })}
          />
          <Button
            type="button"
            variant="outline"
            aria-label={`Remove vasoactive ${index + 1}`}
            onClick={() => onChange(value.filter((_, i) => i !== index))}
          >
            Remove
          </Button>
        </fieldset>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          onChange([
            ...value,
            {
              id: crypto.randomUUID(),
              agent: INOTROPE_AGENT[0].value,
              dose: null,
            },
          ])
        }
      >
        Add vasoactive
      </Button>
    </div>
  )
}
