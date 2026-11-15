import { Link, createFileRoute } from "@tanstack/react-router"
import { useDb } from "@/lib/storage/db"
import { PageHeader } from "@/components/app/page-header"
import { ResultView } from "@/components/evaluation/result-view"
import { DecisionForm } from "@/components/evaluation/decision-form"

export const Route = createFileRoute("/matches/$matchId")({
  component: MatchResultDetail,
})
function MatchResultDetail() {
  const { matchId } = Route.useParams(),
    db = useDb(),
    evaluation = db.evaluations.find((e) => e.id === matchId)
  if (!evaluation)
    return (
      <div>
        <PageHeader title="Match result not found" />
        <Link className="underline" to="/matches">
          Match results
        </Link>
      </div>
    )
  return (
    <div className="space-y-5">
      <PageHeader
        title="Match result"
        description={`Saved ${new Date(evaluation.createdAt).toLocaleString()} by ${evaluation.createdBy || "Unspecified clinician"}. Patient, donor, pair inputs, criteria and result are frozen.`}
      />
      <ResultView
        saved
        result={evaluation.result}
        patient={evaluation.patientSnapshot}
        donor={evaluation.donorSnapshot}
        pair={evaluation.pair}
        criteria={evaluation.criteriaSnapshot}
        criteriaVersion={evaluation.criteriaVersion}
      />
      <DecisionForm
        key={evaluation.id}
        evaluation={evaluation}
        clinician={db.clinicianName}
      />
    </div>
  )
}
