import type { ComponentProps } from "react"
import { Link } from "@tanstack/react-router"
import type { MatchDetail } from "@/domain/match-types"
import type { Decision } from "@/domain/schema"
import { DECISION_VERDICT, DECLINE_REASON } from "@/domain/options"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DecisionForm } from "./decision-form"
import { LocalTime } from "@/components/app/local-time"

function DecisionCard({ decision: d }: { decision: Decision }) {
  const rows: Array<[string, React.ReactNode]> = [
    ["Decision", DECISION_VERDICT.find((o) => o.value === d.verdict)?.label],
    ["Clinician", d.clinician],
    [
      "Decided",
      <time dateTime={d.decidedAt} suppressHydrationWarning>
        <LocalTime value={d.decidedAt} />
      </time>,
    ],
    [
      "Reasons",
      d.reasons
        .map((r) => DECLINE_REASON.find((o) => o.value === r)?.label ?? r)
        .join(", ") || "None",
    ],
    [
      "FAIL / REVIEW acknowledged",
      d.acknowledgedFindings ? "Yes" : "Not required",
    ],
  ]
  return (
    <Card>
      <CardHeader>
        <CardTitle>Final decision</CardTitle>
        <CardDescription>Recorded decisions are read-only.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        <div>
          <p className="text-xs text-muted-foreground">Rationale</p>
          <p className="text-sm whitespace-pre-wrap">{d.rationale}</p>
        </div>
      </CardContent>
    </Card>
  )
}

export function DecisionPanel({
  detail,
  clinician,
  practice,
}: {
  detail: MatchDetail
  clinician: string
  /** Practice screen: nothing is saved. */
  practice?: ComponentProps<typeof DecisionForm>["practice"]
}) {
  if (detail.decision) return <DecisionCard decision={detail.decision} />
  if (detail.source === "screening")
    return (
      <Card>
        <CardHeader>
          <CardTitle>Screening result</CardTitle>
          <CardDescription>
            Matching screened this pair with blank pair inputs (distance,
            ischemic times, crossmatch), so a decision is not available here.
            Complete the match with real pair inputs to record a decision.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            className="w-full"
            nativeButton={false}
            render={
              <Link
                to="/matches/check"
                search={{
                  patientId: detail.patientId,
                  donorId: detail.donorId,
                }}
                hash="pair-inputs"
              />
            }
          >
            Complete this match
          </Button>
        </CardContent>
      </Card>
    )
  return (
    <Card>
      <CardHeader>
        <CardTitle>Record clinician decision</CardTitle>
      </CardHeader>
      <CardContent>
        <DecisionForm
          key={detail.id}
          match={detail}
          clinician={clinician}
          practice={practice}
        />
      </CardContent>
    </Card>
  )
}
