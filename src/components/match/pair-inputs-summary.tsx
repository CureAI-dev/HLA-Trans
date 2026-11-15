import type { PairInputs } from "@/domain/schema"
import { CROSSMATCH, PRESERVATION } from "@/domain/options"

export function PairInputsSummary({
  pair,
  title = "Pair inputs",
}: {
  pair: PairInputs
  title?: string
}) {
  const rows: Array<[string, string | number | null | undefined]> = [
    ["Distance (NM)", pair.distanceNm],
    ["Procurement (minutes)", pair.procurementMinutes],
    ["Transport (minutes)", pair.transportMinutes],
    ["Implant (minutes)", pair.implantMinutes],
    ["Perfusion (minutes)", pair.perfusionMinutes],
    [
      "Preservation",
      PRESERVATION.find((o) => o.value === pair.preservation)?.label,
    ],
    [
      "Flow crossmatch",
      CROSSMATCH.find((o) => o.value === pair.flowCrossmatch)?.label,
    ],
    [
      "CDC crossmatch",
      CROSSMATCH.find((o) => o.value === pair.cdcCrossmatch)?.label,
    ],
  ]
  return (
    <section aria-label={title} className="border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="font-medium">
              {value ?? (
                <span className="font-normal text-unknown">Not recorded</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
