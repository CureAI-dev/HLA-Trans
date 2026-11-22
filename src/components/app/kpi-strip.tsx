import type { ReactNode } from "react"
import { cn } from "cn"
import { Skeleton } from "@/components/ui/skeleton"

export type Kpi = {
  label: string
  value: ReactNode
  detail?: ReactNode
  /** Present when the tile toggles a list filter. */
  pressed?: boolean
  onToggle?: () => void
}

const tile =
  "flex min-w-0 flex-col gap-0.5 border bg-card px-3 py-2.5 text-left"

/**
 * Counts over every record matching the list's filters. A tile with
 * `onToggle` applies (or clears) its filter. `stale` dims the numbers while
 * new counts load, instead of flashing a skeleton.
 */
export function KpiStrip({
  label,
  items,
  stale = false,
}: {
  label: string
  items: ReadonlyArray<Kpi> | null
  stale?: boolean
}) {
  const grid =
    "mb-4 grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]"
  if (!items)
    return (
      <div className={grid} aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-[4.25rem]" />
        ))}
      </div>
    )
  return (
    <section
      aria-label={label}
      aria-busy={stale}
      className={cn(grid, "transition-opacity", stale && "opacity-60")}
    >
      {items.map((kpi) => {
        const body = (
          <>
            <span className="text-xs text-muted-foreground">{kpi.label}</span>
            <span className="text-xl leading-tight font-semibold tabular-nums">
              {kpi.value}
            </span>
            {kpi.detail != null && (
              <span className="truncate text-xs text-muted-foreground tabular-nums">
                {kpi.detail}
              </span>
            )}
          </>
        )
        return kpi.onToggle ? (
          <button
            key={kpi.label}
            type="button"
            aria-pressed={kpi.pressed ?? false}
            onClick={kpi.onToggle}
            className={cn(
              tile,
              "cursor-pointer hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-pressed:border-primary aria-pressed:bg-primary/10"
            )}
          >
            {body}
          </button>
        ) : (
          <div key={kpi.label} className={tile}>
            {body}
          </div>
        )
      })}
    </section>
  )
}

export const percent = (part: number, whole: number) =>
  whole ? `${Math.round((part / whole) * 100)}%` : "–"
