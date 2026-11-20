import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Option } from "@/domain/options"
import { FieldFrame, useField } from "./field-frame"
import type { FieldProps } from "./field-frame"

export interface SelectFieldProps<
  T extends string = string,
> extends FieldProps {
  value: T
  onChange: (value: T) => void
  options: ReadonlyArray<Option<T>>
  placeholder?: string
}
export function SelectField<T extends string>(props: SelectFieldProps<T>) {
  const field = useField(props)
  const groups = [...new Set(props.options.map((option) => option.group))]
  const renderItems = (options: ReadonlyArray<Option<T>>) =>
    options.map((option) => (
      <SelectItem key={option.value} value={option.value}>
        {option.label}
      </SelectItem>
    ))
  return (
    <FieldFrame {...props} id={field.id}>
      <Select
        items={props.options}
        value={props.value === "" ? null : props.value}
        disabled={props.disabled}
        onValueChange={(value) => {
          const option = props.options.find((item) => item.value === value)
          if (option) props.onChange(option.value)
        }}
      >
        <SelectTrigger {...field} className="w-full">
          <SelectValue placeholder={props.placeholder} />
        </SelectTrigger>
        <SelectContent>
          {groups.map((group) =>
            group ? (
              <SelectGroup key={group}>
                <SelectLabel>{group}</SelectLabel>
                {renderItems(
                  props.options.filter((option) => option.group === group)
                )}
              </SelectGroup>
            ) : (
              renderItems(props.options.filter((option) => !option.group))
            )
          )}
        </SelectContent>
      </Select>
    </FieldFrame>
  )
}
