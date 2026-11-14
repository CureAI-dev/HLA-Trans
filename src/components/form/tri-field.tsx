import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { TRI } from "@/domain/options"
import type { Tri } from "@/domain/options"
import { FieldFrame, useField } from "./field-frame"
import type { FieldProps } from "./field-frame"

export interface TriFieldProps extends FieldProps {
  value: Tri
  onChange: (value: Tri) => void
}
export function TriField(props: TriFieldProps) {
  const field = useField(props)
  return (
    <FieldFrame {...props} id={field.id}>
      <ToggleGroup
        {...field}
        aria-label={props.label}
        value={[props.value]}
        disabled={props.disabled}
        onValueChange={(values) => {
          const next = TRI.find((option) => option.value === values[0])
          if (next) props.onChange(next.value)
        }}
      >
        {TRI.map((option) => (
          <ToggleGroupItem key={option.value} value={option.value}>
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </FieldFrame>
  )
}
