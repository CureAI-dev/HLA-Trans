import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { Search, X } from "lucide-react"
import { DatePickerField } from "@/components/form/date-picker-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function ListToolbar({
  children,
  canReset,
  onReset,
}: {
  children: ReactNode
  canReset: boolean
  onReset: () => void
}) {
  return (
    <div role="search" className="mb-4 flex flex-wrap items-center gap-2">
      {children}
      {canReset && (
        <Button variant="ghost" onClick={onReset}>
          <X aria-hidden="true" /> Reset
        </Button>
      )}
    </div>
  )
}

/**
 * Local state for instant typing; pushes to the URL 200 ms after the last keystroke.
 * `onChange` must be stable (useCallback) for the debounce effect.
 */
export function SearchInput({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  label: string
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  useEffect(() => {
    if (draft === value) return
    const timer = setTimeout(() => onChange(draft), 200)
    return () => clearTimeout(timer)
  }, [draft, value, onChange])
  return (
    <div className="relative w-full max-w-sm">
      <Search
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        aria-label={label}
        placeholder={placeholder}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="pl-8"
      />
    </div>
  )
}

const ALL = "__all__"

export function FilterSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T | undefined
  options: ReadonlyArray<{ value: T; label: string }>
  onChange: (v: T | undefined) => void
}) {
  const items = [
    { value: ALL, label: `${label}: All` },
    ...options.map((o) => ({ value: o.value, label: `${label}: ${o.label}` })),
  ]
  return (
    <Select
      items={items}
      value={value ?? ALL}
      onValueChange={(v) =>
        onChange(v === ALL || v === null ? undefined : (v as T))
      }
    >
      <SelectTrigger aria-label={label} className="w-auto min-w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

const isoDay = /^\d{4}-\d{2}-\d{2}$/

/** Toolbar date filter: the label stays for screen readers but is hidden so the row stays one line. */
export function DateFilter({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string
  value: string | undefined
  onChange: (v: string | undefined) => void
  min?: string
  max?: string
}) {
  return (
    <div className="w-44 [&_label]:sr-only">
      <DatePickerField
        label={label}
        value={value ?? ""}
        min={min}
        max={max}
        disableFuture
        captionLayout="label"
        onChange={(v) => onChange(isoDay.test(v) ? v : undefined)}
      />
    </div>
  )
}
