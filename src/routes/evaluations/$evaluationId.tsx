import { createFileRoute } from "@tanstack/react-router"
import { useDb } from "@/lib/storage/db"
import { PageHeader } from "@/components/app/page-header"
import { ResultView } from "@/components/evaluation/result-view"
import { DecisionForm } from "@/components/evaluation/decision-form"

export const Route = createFileRoute("/evaluations/$evaluationId")({
  component: EvaluationDetail,
})
function EvaluationDetail() {
  const { evaluationId } = Route.useParams(),
    db = useDb(),
    evaluation = db.evaluations.find((e) => e.id === evaluationId)
  if (!evaluation)
    return (
      <div>
        <PageHeader title="Evaluation not found" />
        <a className="underline" href="/evaluations">
          Evaluation history
        </a>
      </div>
    )
  return (
    <div className="space-y-5">
      <PageHeader
        title="Evaluation"
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
