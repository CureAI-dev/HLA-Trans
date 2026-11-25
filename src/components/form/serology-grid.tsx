import type { Option, Serology } from "@/domain/options"
import { SEROLOGY } from "@/domain/options"
import { SelectField } from "./select-field"

export interface SerologyGridProps<T extends string> {
  value: Record<T, Serology>
  onChange: (value: Record<T, Serology>) => void
  tests: ReadonlyArray<Option<T>>
  errors?: Record<string, string>
}
export function SerologyGrid<T extends string>({
  value,
  onChange,
  tests,
  errors,
}: SerologyGridProps<T>) {
  return (
    <div
      data-guide="serology"
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {tests.map((test) => (
        <SelectField
          key={test.value}
          label={test.label}
          value={value[test.value]}
          options={SEROLOGY}
          error={errors?.[test.value]}
          onChange={(next) => onChange({ ...value, [test.value]: next })}
        />
      ))}
    </div>
  )
}
