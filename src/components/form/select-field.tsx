import {
  NativeSelect,
  NativeSelectOption,
  NativeSelectOptGroup,
} from "@/components/ui/native-select"
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
  return (
    <FieldFrame {...props} id={field.id}>
      <NativeSelect
        {...field}
        value={props.value}
        disabled={props.disabled}
        onChange={(event) => {
          const option = props.options.find(
            (item) => item.value === event.target.value
          )
          if (option) props.onChange(option.value)
        }}
      >
        {props.placeholder && (
          <NativeSelectOption value="" disabled>
            {props.placeholder}
          </NativeSelectOption>
        )}
        {groups.map((group) =>
          group ? (
            <NativeSelectOptGroup key={group} label={group}>
              {props.options
                .filter((option) => option.group === group)
                .map((option) => (
                  <NativeSelectOption key={option.value} value={option.value}>
                    {option.label}
                  </NativeSelectOption>
                ))}
            </NativeSelectOptGroup>
          ) : (
            props.options
              .filter((option) => !option.group)
              .map((option) => (
                <NativeSelectOption key={option.value} value={option.value}>
                  {option.label}
                </NativeSelectOption>
              ))
          )
        )}
      </NativeSelect>
    </FieldFrame>
  )
}
