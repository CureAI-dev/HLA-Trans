import {
  CircleCheck,
  CircleHelp,
  Info,
  OctagonX,
  TriangleAlert,
} from "lucide-react"
import { cn } from "cn"
import { RULE_IDS } from "@/domain/schema"
import type { Finding, RuleResult } from "@/domain/schema"

type StatusProps = {
  status: Finding["status"]
  missing?: boolean
  className?: string
}
const labels = { pass: "PASS", review: "REVIEW", fail: "FAIL", info: "INFO" }
const colors = {
  pass: "text-pass",
  review: "text-caution",
  fail: "text-fail",
  info: "text-unknown",
}

export function StatusIcon({
  status,
  missing = false,
  className,
}: StatusProps) {
  const Icon = missing
    ? CircleHelp
    : { pass: CircleCheck, review: TriangleAlert, fail: OctagonX, info: Info }[
        status
      ]
  return (
    <Icon
      aria-hidden="true"
      className={cn(
        "size-4 shrink-0",
        missing ? "text-unknown" : colors[status],
        className
      )}
    />
  )
}

export function StatusBadge({
  status,
  missing = false,
  className,
}: StatusProps) {
  const effectiveStatus = missing && status === "pass" ? "review" : status
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border px-2 py-1 text-xs font-semibold",
        missing ? "text-unknown" : colors[effectiveStatus],
        className
      )}
    >
      <StatusIcon status={effectiveStatus} missing={missing} />
      {labels[effectiveStatus]}
      {missing && " · Missing data"}
    </span>
  )
}

const ruleLabels = {
  abo: "ABO",
  size: "Size",
  immunology: "Immunology",
  infection: "Infection",
  donorHeart: "Donor heart",
  logistics: "Logistics",
}

export function VerdictStrip({ rules }: { rules: Array<RuleResult> }) {
  return (
    <nav
      aria-label="Evaluation rules"
      className="grid grid-cols-2 border-t border-l sm:grid-cols-3 xl:grid-cols-6"
    >
      {RULE_IDS.map((id) => {
        const rule = rules.find((item) => item.rule === id)
        const missing =
          !rule || rule.findings.some((finding) => finding.missing)
        return (
          <a
            key={id}
            href={`#rule-${id}`}
            className="flex flex-col gap-2 border-r border-b bg-card p-3 hover:bg-muted"
          >
            <span className="text-sm font-medium">{ruleLabels[id]}</span>
            <StatusBadge status={rule?.status ?? "review"} missing={missing} />
          </a>
        )
      })}
    </nav>
  )
}
