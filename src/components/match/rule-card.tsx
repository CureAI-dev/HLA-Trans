import { useState } from "react"
import type { Finding, RuleId, RuleResult } from "@/domain/schema"
import { StatusBadge, StatusIcon } from "@/components/app/status"
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"

export const RULE_TITLES: Record<RuleId, string> = {
  abo: "Blood type",
  size: "Size",
  immunology: "HLA and antibodies",
  infection: "Infection",
  donorHeart: "Donor heart",
  logistics: "Ischemic time and logistics",
}

export function FindingRow({ finding }: { finding: Finding }) {
  return (
    <li className="grid grid-cols-[20px_minmax(0,1fr)] gap-x-3 border-t py-3 first:border-t-0">
      <StatusIcon
        status={finding.status}
        missing={finding.missing}
        className="mt-0.5"
      />
      <div className="max-w-[72ch] space-y-1.5">
        <p className="text-sm font-medium text-foreground">
          {finding.title}
          {finding.missing && (
            <span className="ml-2 text-xs font-normal text-unknown">
              Missing data
            </span>
          )}
        </p>
        <p className="text-sm leading-relaxed text-foreground/90">
          {finding.detail}
        </p>
        <dl className="grid grid-cols-[64px_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <dt>Evidence</dt>
          <dd className="text-foreground/80">
            {finding.evidence || "Not recorded"}
          </dd>
          <dt>Source</dt>
          <dd>{finding.source}</dd>
        </dl>
      </div>
    </li>
  )
}

function tally(findings: Finding[]) {
  const n = (s: Finding["status"]) =>
    findings.filter((f) => f.status === s).length
  return (["fail", "review", "pass", "info"] as const)
    .map((s) => (n(s) ? `${n(s)} ${s}` : ""))
    .filter(Boolean)
    .join(" · ")
}

export function RuleAccordionItem({ rule }: { rule: RuleResult }) {
  const [showInfo, setShowInfo] = useState(false)
  const main = rule.findings.filter((f) => f.status !== "info")
  const info = rule.findings.filter((f) => f.status === "info")
  return (
    <AccordionItem
      value={rule.rule}
      id={`rule-${rule.rule}`}
      className="scroll-mt-44 border bg-card px-4 not-last:border-b"
    >
      <AccordionTrigger className="items-center py-3 hover:no-underline">
        <span className="flex flex-1 flex-wrap items-center gap-3 text-left">
          <span className="text-base font-semibold">
            {RULE_TITLES[rule.rule]}
          </span>
          <StatusBadge status={rule.status} />
          <span className="text-xs font-normal text-muted-foreground">
            {tally(rule.findings)}
          </span>
        </span>
      </AccordionTrigger>
      <AccordionContent>
        {main.length > 0 ? (
          <ul>
            {main.map((f) => (
              <FindingRow key={f.code} finding={f} />
            ))}
          </ul>
        ) : (
          <p className="py-2 text-sm text-muted-foreground">
            No PASS, REVIEW or FAIL findings for this rule.
          </p>
        )}
        {info.length > 0 && (
          <>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="px-0"
              onClick={() => setShowInfo((v) => !v)}
              aria-expanded={showInfo}
            >
              {showInfo ? "Hide" : "Show"} {info.length} info finding
              {info.length > 1 ? "s" : ""}
            </Button>
            {showInfo && (
              <ul>
                {info.map((f) => (
                  <FindingRow key={f.code} finding={f} />
                ))}
              </ul>
            )}
          </>
        )}
      </AccordionContent>
    </AccordionItem>
  )
}
