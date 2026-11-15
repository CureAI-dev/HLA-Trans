import { createFileRoute } from "@tanstack/react-router"
import { PageHeader } from "@/components/app/page-header"
import { CriteriaForm } from "@/components/criteria/criteria-form"
import { CriteriaHistory } from "@/components/criteria/criteria-history"
import { actions, latestCriteria, useDb } from "@/lib/storage/db"

export const Route = createFileRoute("/criteria")({ component: CriteriaPage })
function CriteriaPage() {
  const db = useDb()
  const current = latestCriteria(db)
  return (
    <>
      <PageHeader
        title="Criteria"
        description="Manage the thresholds and finding outcomes used for new match results."
      />
      <p className="mb-6 border bg-muted p-4 text-sm">
        Changing criteria does not change past evaluations.
      </p>
      <CriteriaForm current={current} publish={actions.publishCriteria} />
      <CriteriaHistory versions={db.criteriaVersions} />
    </>
  )
}
