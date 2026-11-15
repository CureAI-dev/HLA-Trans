import type { ReactNode } from "react"
import { cn } from "cn"
import type { RuleId, RuleResult } from "@/domain/schema"
import { StatusBadge, StatusIcon } from "@/components/app/status"
import { Badge } from "@/components/ui/badge"
import { RULE_TITLES } from "./rule-card"

export function VerdictBar({
  overall,
  patientName,
  donorCode,
  sourceLabel,
  criteriaVersion,
  engineVersion,
  outOfDate,
  rules,
  onRule,
  meta,
  bleed = true,
}: {
  overall: RuleResult["status"]
  patientName: string
  donorCode: string
  sourceLabel: string
  criteriaVersion: number
  engineVersion: string
  outOfDate: boolean
  rules: RuleResult[]
  onRule: (id: RuleId) => void
  meta?: ReactNode
  /** Stretch to the page edges (full-width page) instead of the parent column. */
  bleed?: boolean
}) {
  return (
    <section
      aria-label="Overall result"
      className={cn(
        "sticky top-0 z-20 mb-6 border-b bg-background/95 py-3 backdrop-blur",
        bleed ? "-mx-4 px-4 lg:-mx-6 lg:px-6" : "border-x border-t px-4"
      )}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <StatusBadge status={overall} className="text-sm" />
        <h2 className="text-lg font-semibold">
          {patientName}{" "}
          <span aria-label="with" className="text-muted-foreground">
            ↔
          </span>{" "}
          <span className="font-mono">{donorCode}</span>
        </h2>
        <span className="text-xs text-muted-foreground">
          {sourceLabel} · criteria v{criteriaVersion} · engine {engineVersion}
        </span>
        {outOfDate && (
          <Badge variant="outline" className="text-caution">
            Out of date: records or criteria changed
          </Badge>
        )}
      </div>
      <nav aria-label="Rule groups" className="mt-3 flex flex-wrap gap-2">
        {rules.map((r) => {
          const missing = r.findings.some((f) => f.missing)
          return (
            <button
              key={r.rule}
              type="button"
              onClick={() => onRule(r.rule)}
              className="inline-flex items-center gap-1.5 border bg-card px-2.5 py-1 text-xs hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
            >
              <StatusIcon status={r.status} />
              {RULE_TITLES[r.rule]}
              <span className="sr-only">: {r.status.toUpperCase()}</span>
              {missing && (
                <span className="text-unknown" title="Missing data">
                  ?
                  <span className="sr-only"> missing data</span>
                </span>
              )}
            </button>
          )
        })}
      </nav>
      <p className="mt-2 text-xs text-muted-foreground">
        The app advises; the clinician makes the final decision.
        {meta && <> {meta}</>}
      </p>
    </section>
  )
}
