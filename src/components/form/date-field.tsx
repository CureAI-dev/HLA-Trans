import { DatePickerField } from "./date-picker-field"
import type { DatePickerFieldProps } from "./date-picker-field"
import type { FieldProps } from "./field-frame"

export interface DateFieldProps extends FieldProps {
  value: string
  onChange: (value: string) => void
  min?: string
  max?: string
}

/** Every date input is the shadcn picker (typed entry plus calendar). Kept as an alias so call sites need no rename. */
export function DateField(props: DatePickerFieldProps) {
  return <DatePickerField {...props} />
}
