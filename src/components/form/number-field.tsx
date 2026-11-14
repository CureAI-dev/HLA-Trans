import { Input } from "@/components/ui/input"
import { FieldFrame, useField } from "./field-frame"
import type { FieldProps } from "./field-frame"
import { parseNumberInput } from "./form-helpers"

export interface NumberFieldProps extends FieldProps {
  unit: string
  value: number | null
  onChange: (value: number | null) => void
  min?: number
  max?: number
  step?: number | "any"
}
export function NumberField(props: NumberFieldProps) {
  const field = useField(props)
  return (
    <FieldFrame {...props} id={field.id}>
      <div className="flex items-center gap-2">
        <Input
          {...field}
          type="number"
          value={props.value ?? ""}
          disabled={props.disabled}
          min={props.min}
          max={props.max}
          step={props.step ?? "any"}
          onChange={(event) => {
            const next = parseNumberInput(event.target.value)
            if (next !== undefined && !event.target.validity.badInput)
              props.onChange(next)
          }}
        />
        <span className="shrink-0 text-xs text-muted-foreground">
          {props.unit}
        </span>
      </div>
    </FieldFrame>
  )
}
