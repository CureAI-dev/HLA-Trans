import { Info } from "lucide-react"

export function DemoBanner() {
  return (
    <div className="flex items-start gap-2 border-b bg-muted px-4 py-2 text-xs text-muted-foreground">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>Demo environment: synthetic records. Not for clinical use.</p>
    </div>
  )
}
