import { useCallback, useReducer } from "react"
import type { z } from "zod"
import { updateAtPath } from "./form-helpers"
import type { Path, PathValue } from "./form-helpers"

export type { Path, PathValue } from "./form-helpers"

export type FormErrors = Record<string, string>
export type FormState<T> = { value: T; errors: FormErrors; dirty: boolean }
export type FormAction<T> =
  | { type: "set"; path: string; value: unknown }
  | {
      type: "errors"
      errors: FormErrors | ((previous: FormErrors) => FormErrors)
    }
  | { type: "reset"; value: T }

/** Referentially stable setter: memoised sections receive the same function on every render. */
export type FormSetter<T> = <TPath extends Path<T>>(
  path: TPath,
  value: PathValue<T, TPath>
) => void

export const initialFormState = <T>(value: T): FormState<T> => ({
  value,
  errors: {},
  dirty: false,
})

const touches = (key: string, path: string) =>
  key === path || key.startsWith(`${path}.`)

/**
 * O(depth) per keystroke: updateAtPath copies only the changed branch, so every
 * untouched section keeps its object identity. The errors object keeps its
 * identity too unless the edit actually clears an error.
 */
export function formReducer<T>(
  state: FormState<T>,
  action: FormAction<T>
): FormState<T> {
  switch (action.type) {
    case "set": {
      const keys = Object.keys(state.errors)
      const errors = keys.some((k) => touches(k, action.path))
        ? Object.fromEntries(
            Object.entries(state.errors).filter(
              ([k]) => !touches(k, action.path)
            )
          )
        : state.errors
      return {
        value: updateAtPath(state.value, action.path, action.value),
        errors,
        dirty: true,
      }
    }
    case "errors":
      return {
        ...state,
        errors:
          typeof action.errors === "function"
            ? action.errors(state.errors)
            : action.errors,
      }
    case "reset":
      return initialFormState(action.value)
  }
}

export function useFormState<T>(initial: T, schema: z.ZodType<T>) {
  const [state, dispatch] = useReducer(
    formReducer<T>,
    initial,
    initialFormState<T>
  )
  const set: FormSetter<T> = useCallback(
    (path, value) => dispatch({ type: "set", path, value }),
    []
  )
  const setErrors = useCallback(
    (errors: FormErrors | ((previous: FormErrors) => FormErrors)) =>
      dispatch({ type: "errors", errors }),
    []
  )
  const reset = useCallback(
    (value: T) => dispatch({ type: "reset", value }),
    []
  )
  const validate = (): T | null => {
    const result = schema.safeParse(state.value)
    if (result.success) {
      setErrors({})
      return result.data
    }
    const next: FormErrors = {}
    for (const issue of result.error.issues)
      next[issue.path.join(".")] ??= issue.message
    setErrors(next)
    return null
  }
  return {
    value: state.value,
    errors: state.errors,
    dirty: state.dirty,
    set,
    setErrors,
    validate,
    reset,
  }
}
