import { useMemo, useRef } from "react"
import type { FormErrors, FormSetter } from "./use-form-state"

/** Shared, frozen empty map: a section without errors always gets this exact object. */
export const NO_ERRORS: FormErrors = Object.freeze({})

export type SectionErrors = Record<string, FormErrors>

/** Props every memoised form section receives. `errors` is keyed without the section prefix. */
export type SectionProps<T, TKey extends keyof T> = {
  value: T[TKey]
  errors: FormErrors
  set: FormSetter<T>
}

function shallowEqual(a: FormErrors, b: FormErrors): boolean {
  const ak = Object.keys(a)
  if (ak.length !== Object.keys(b).length) return false
  return ak.every((k) => a[k] === b[k])
}

/**
 * Split flat dotted errors into one map per section. A key whose head is the
 * section id loses that prefix (`identity.mrn` → `mrn`, `notes` → `notes`);
 * a key that `sectionOf` routes elsewhere keeps its full name
 * (`serologyDate` → serology section, key `serologyDate`).
 *
 * Pure. Pass the previous result to reuse every inner object whose contents
 * did not change, so `memo` sections see the same `errors` prop.
 */
export function splitSectionErrors(
  errors: FormErrors,
  ids: ReadonlyArray<string>,
  sectionOf: (key: string) => string,
  previous: SectionErrors | undefined
): SectionErrors {
  const draft: Partial<SectionErrors> = {}
  for (const [key, message] of Object.entries(errors)) {
    const section = sectionOf(key)
    if (!ids.includes(section)) continue
    const [head, ...rest] = key.split(".")
    const inner = head === section ? rest.join(".") || head : key
    ;(draft[section] ??= {})[inner] = message
  }
  const out: SectionErrors = {}
  for (const id of ids) {
    const next = draft[id]
    const prev = previous?.[id]
    out[id] = !next ? NO_ERRORS : prev && shallowEqual(prev, next) ? prev : next
  }
  return out
}

/** Hook form of `splitSectionErrors` with a ref cache for stable inner objects. */
export function useSectionErrors(
  errors: FormErrors,
  ids: ReadonlyArray<string>,
  sectionOf: (key: string) => string
): SectionErrors {
  const cache = useRef<SectionErrors | undefined>(undefined)
  return useMemo(() => {
    const next = splitSectionErrors(errors, ids, sectionOf, cache.current)
    cache.current = next
    return next
  }, [errors, ids, sectionOf])
}

/** Errors under `prefix.` with the prefix removed (for composite inputs such as tables and grids). */
export function subErrors(errors: FormErrors, prefix: string): FormErrors {
  const out: FormErrors = {}
  for (const [key, message] of Object.entries(errors))
    if (key.startsWith(`${prefix}.`))
      out[key.slice(prefix.length + 1)] = message
  return out
}
