import { Switch } from "@/components/ui/switch"
import { FieldFrame, useField } from "./field-frame"
import type { FieldProps } from "./field-frame"

export interface SwitchFieldProps extends FieldProps {
  value: boolean
  onChange: (value: boolean) => void
}
export function SwitchField(props: SwitchFieldProps) {
  const field = useField(props)
  return (
    <FieldFrame {...props} id={field.id}>
      <Switch
        {...field}
        checked={props.value}
        disabled={props.disabled}
        onCheckedChange={props.onChange}
      />
    </FieldFrame>
  )
}
