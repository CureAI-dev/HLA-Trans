import { memo, useEffect, useMemo } from "react"
import { CircleAlert } from "lucide-react"
import { getAtPath, isBlank } from "@/components/record/record-spec"
import type { RecordSection } from "@/components/record/record-spec"
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress"
import type { SectionStatus } from "./form-layout"
import type { FormErrors } from "./use-form-state"
import type { SectionErrors } from "./section-errors"

/** DOM id given to the input of the field at `path` (validation summary focuses it). */
export const fieldId = (path: string) => `field-${path}`

/**
 * Focus the input for an error key. Composite inputs (HLA grid, antibody rows)
 * have no id per cell, so walk up the path, then fall back to the first invalid
 * control in the section, then the section itself.
 */
export function focusField(key: string, section: string | undefined) {
  const parts = key.split(".")
  for (let i = parts.length; i > 0; i--) {
    const el = document.getElementById(fieldId(parts.slice(0, i).join(".")))
    if (el) {
      el.scrollIntoView({ block: "center" })
      el.focus()
      return
    }
  }
  const sectionEl = section ? document.getElementById(section) : null
  const invalid = sectionEl?.querySelector<HTMLElement>("[aria-invalid='true']")
  ;(invalid ?? sectionEl)?.scrollIntoView({ block: "center" })
  invalid?.focus()
}

/** Scroll to the section named in `location.hash` once, on mount (detail pages link to edit#section). */
export function useHashScroll() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1))
    if (id) document.getElementById(id)?.scrollIntoView({ block: "start" })
  }, [])
}

/**
 * Per-section missing/error counts plus overall completeness. Switches are
 * excluded: a boolean always holds a value, so it cannot show "not recorded".
 */
export function useFormCompleteness(
  value: unknown,
  sections: ReadonlyArray<RecordSection>,
  sectionErrors: SectionErrors
) {
  return useMemo(() => {
    const status: Record<string, SectionStatus> = {}
    let recorded = 0
    let total = 0
    for (const s of sections) {
      const fields = s.fields.filter((f) => f.format !== "bool")
      const missing = fields.filter((f) =>
        isBlank(getAtPath(value, f.path))
      ).length
      status[s.id] = {
        missing,
        errors: Object.keys(sectionErrors[s.id] ?? {}).length,
      }
      recorded += fields.length - missing
      total += fields.length
    }
    return { status, recorded, total }
  }, [value, sections, sectionErrors])
}

export const CompletenessMeter = memo(function Completeness({
  recorded,
  total,
}: {
  recorded: number
  total: number
}) {
  const pct = total ? Math.round((recorded / total) * 100) : 0
  return (
    <div className="space-y-1 border p-3">
      <Progress value={pct}>
        <ProgressLabel>Record completeness</ProgressLabel>
        <ProgressValue />
      </Progress>
      <p className="text-xs text-muted-foreground">
        {recorded} of {total} clinical fields recorded
      </p>
    </div>
  )
})

/** Label for an error key: the record spec label of the longest matching path. */
function labelFor(key: string, labels: ReadonlyMap<string, string>): string {
  const parts = key.split(".")
  for (let i = parts.length; i > 0; i--) {
    const label = labels.get(parts.slice(0, i).join("."))
    if (label) return label
  }
  return key
}

export const ValidationSummary = memo(function Summary({
  errors,
  sections,
  sectionOf,
}: {
  errors: FormErrors
  sections: ReadonlyArray<RecordSection>
  sectionOf: (key: string) => string
}) {
  const labels = useMemo(
    () =>
      new Map(
        sections.flatMap((s) => s.fields.map((f) => [f.path, f.label] as const))
      ),
    [sections]
  )
  const entries = Object.entries(errors)
  if (!entries.length) return null
  return (
    <div
      role="region"
      aria-label="Fields to correct"
      className="space-y-2 border border-destructive/50 p-3"
    >
      <p className="flex items-center gap-2 text-sm font-medium">
        <CircleAlert className="size-4 text-destructive" aria-hidden="true" />
        {entries.length === 1
          ? "1 field to correct"
          : `${entries.length} fields to correct`}
      </p>
      <ul className="space-y-1 text-sm">
        {entries.map(([key, message]) => (
          <li key={key}>
            <button
              type="button"
              className="text-left underline-offset-4 hover:underline"
              onClick={() => focusField(key, sectionOf(key))}
            >
              <span className="font-medium">{labelFor(key, labels)}</span>
              <span className="text-muted-foreground">: {message}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
})
