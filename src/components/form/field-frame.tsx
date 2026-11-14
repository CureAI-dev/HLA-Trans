import { useId } from "react"
import type { ReactNode } from "react"
import { Label } from "@/components/ui/label"

export interface FieldProps {
  label: string
  id?: string
  error?: string
  hint?: string
  disabled?: boolean
}
export function FieldFrame({
  label,
  id,
  error,
  hint,
  children,
}: FieldProps & { id: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm">
          {error}
        </p>
      )}
    </div>
  )
}
export function useField(props: FieldProps) {
  const generated = useId()
  const id = props.id ?? generated
  return {
    id,
    "aria-invalid": Boolean(props.error),
    "aria-describedby":
      [props.hint && `${id}-hint`, props.error && `${id}-error`]
        .filter(Boolean)
        .join(" ") || undefined,
  }
}
