import { Input } from "@/components/ui/input"
import { FieldFrame, useField } from "./field-frame"
import type { FieldProps } from "./field-frame"

export interface TextFieldProps extends FieldProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  onBlur?: () => void
  className?: string
  maxLength?: number
}
export function TextField(props: TextFieldProps) {
  const field = useField(props)
  return (
    <FieldFrame {...props} id={field.id}>
      <Input
        {...field}
        value={props.value}
        disabled={props.disabled}
        placeholder={props.placeholder}
        onChange={(event) => props.onChange(event.target.value)}
        onBlur={props.onBlur}
        className={props.className}
        maxLength={props.maxLength}
      />
    </FieldFrame>
  )
}
