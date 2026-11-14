import type { Finding, Outcome, RuleId, RuleResult } from "../schema"

export type FindingInput = Omit<Finding, "missing" | "evidence" | "source"> &
  Partial<Pick<Finding, "missing" | "evidence" | "source">>

export function finding(input: FindingInput): Finding {
  return { missing: false, evidence: "", source: "center practice", ...input }
}

export function missingFinding(
  code: string,
  title: string,
  detail: string,
  source?: string
): Finding {
  return finding({
    code,
    title,
    detail,
    status: "review",
    missing: true,
    ...(source === undefined ? {} : { source }),
  })
}

export function outcomeFinding(
  outcome: Outcome,
  input: Omit<FindingInput, "status">
): Finding {
  return finding({ ...input, status: outcome })
}

export function worst(
  findings: ReadonlyArray<Pick<Finding, "status">>
): Outcome {
  if (findings.some((f) => f.status === "fail")) return "fail"
  return findings.some((f) => f.status === "review") ? "review" : "pass"
}

export function ruleResult(rule: RuleId, findings: Array<Finding>): RuleResult {
  return { rule, status: worst(findings), findings }
}
