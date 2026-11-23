import { Fragment, useEffect, useState } from "react"
import type { ReactNode } from "react"
import { Search, X } from "lucide-react"
import { DatePickerField } from "@/components/form/date-picker-field"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
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
  // Remounting the controls on reset also drops search text that was never submitted.
  const [resets, setResets] = useState(0)
  return (
    <div role="search" className="mb-4 flex flex-wrap items-center gap-2">
      <Fragment key={resets}>{children}</Fragment>
      {canReset && (
        <Button
          variant="ghost"
          onClick={() => {
            setResets((n) => n + 1)
            onReset()
          }}
        >
          <X aria-hidden="true" /> Reset
        </Button>
      )}
    </div>
  )
}

/** Typing stays local; the search runs on Enter or the search button. */
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
  return (
    <form
      className="w-full max-w-sm"
      onSubmit={(e) => {
        e.preventDefault()
        const next = draft.trim()
        setDraft(next)
        if (next !== value) onChange(next)
      }}
    >
      <InputGroup>
        <InputGroupInput
          aria-label={label}
          placeholder={placeholder}
          enterKeyHint="search"
          maxLength={100}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton type="submit" size="icon-xs" aria-label="Search">
            <Search aria-hidden="true" />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </form>
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
