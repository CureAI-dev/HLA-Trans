import { Input } from "@/components/ui/input"
import { FieldFrame, useField } from "./field-frame"
import type { FieldProps } from "./field-frame"

export interface DateFieldProps extends FieldProps {
  value: string
  onChange: (value: string) => void
  min?: string
  max?: string
}
export function DateField(props: DateFieldProps) {
  const field = useField(props)
  return (
    <FieldFrame {...props} id={field.id}>
      <Input
        {...field}
        type="date"
        value={props.value}
        disabled={props.disabled}
        min={props.min}
        max={props.max}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </FieldFrame>
  )
}
