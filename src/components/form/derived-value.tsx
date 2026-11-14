import type { ReactNode } from "react"

export interface DerivedValueProps {
  label: string
  value: ReactNode
  unit: string
  hint?: string
}
export function DerivedValue({ label, value, unit, hint }: DerivedValueProps) {
  return (
    <div className="border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <output className="tabular-nums">
        {value ?? "Not recorded"} {unit}
      </output>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
