import type { RuleResult, Finding } from "@/domain/schema"
import { StatusBadge } from "@/components/app/status"

export function FindingView({ finding }: { finding: Finding }) {
  return (
    <li className="space-y-2 border-t py-3">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={finding.status} missing={finding.missing} />
        <h3 className="font-medium">{finding.title}</h3>
      </div>
      <p>{finding.detail}</p>
      <p className="text-sm">
        <strong>Evidence:</strong> {finding.evidence || "Not recorded"}
      </p>
      <p className="text-sm text-muted-foreground">
        <strong>Source:</strong> {finding.source}
      </p>
    </li>
  )
}
export function RuleCard({ rule }: { rule: RuleResult }) {
  return (
    <details
      open
      id={`rule-${rule.rule}`}
      className="scroll-mt-20 border bg-card p-4"
    >
      <summary className="mb-3 cursor-pointer items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          {
            {
              abo: "Blood type",
              size: "Size",
              immunology: "HLA and antibodies",
              infection: "Infection",
              donorHeart: "Donor heart",
              logistics: "Ischemic time and logistics",
            }[rule.rule]
          }
        </h2>
        <StatusBadge status={rule.status} />
      </summary>
      <ul>
        {rule.findings.map((f) => (
          <FindingView key={f.code} finding={f} />
        ))}
      </ul>
    </details>
  )
}
