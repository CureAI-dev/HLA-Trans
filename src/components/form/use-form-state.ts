import { useState } from "react"
import { useBlocker } from "@tanstack/react-router"
import type { z } from "zod"
import { updateAtPath } from "./form-helpers"
import type { Path, PathValue } from "./form-helpers"

export type { Path, PathValue } from "./form-helpers"
export function useFormState<T>(initial: T, schema: z.ZodType<T>) {
  const [value, setValue] = useState(initial)
  const [baseline, setBaseline] = useState(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const dirty = JSON.stringify(value) !== JSON.stringify(baseline)
  useBlocker({
    shouldBlockFn: () => dirty && !window.confirm("Discard unsaved changes?"),
    enableBeforeUnload: dirty,
  })
  const set = <TPath extends Path<T>>(path: TPath, v: PathValue<T, TPath>) => {
    setValue((previous) => updateAtPath(previous, path, v))
    setErrors((previous) =>
      Object.fromEntries(
        Object.entries(previous).filter(
          ([key]) => key !== path && !key.startsWith(`${path}.`)
        )
      )
    )
  }
  const validate = (): T | null => {
    const result = schema.safeParse(value)
    if (result.success) {
      setErrors({})
      return result.data
    }
    const next: Record<string, string> = {}
    for (const issue of result.error.issues)
      next[issue.path.join(".")] = issue.message
    setErrors(next)
    return null
  }
  const reset = (next: T) => {
    setValue(next)
    setBaseline(next)
    setErrors({})
  }
  return { value, set, errors, dirty, validate, reset }
}
