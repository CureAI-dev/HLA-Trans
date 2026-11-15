import { createFileRoute } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import { criteriaQueries } from "@/features/criteria/criteria.queries"
import { usePublishCriteria } from "@/features/criteria/criteria.mutations"
import { PageHeader } from "@/components/app/page-header"
import { FormPageSkeleton } from "@/components/app/page-skeletons"
import { CriteriaForm } from "@/components/criteria/criteria-form"
import { CriteriaHistory } from "@/components/criteria/criteria-history"

export const Route = createFileRoute("/criteria")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(criteriaQueries.latest()),
      context.queryClient.ensureQueryData(criteriaQueries.versions()),
    ]),
  head: () => ({ meta: [{ title: "Criteria · HLA-Trans" }] }),
  pendingComponent: FormPageSkeleton,
  component: CriteriaPage,
})

function CriteriaPage() {
  const { data: current } = useSuspenseQuery(criteriaQueries.latest())
  const { data: versions } = useSuspenseQuery(criteriaQueries.versions())
  const publish = usePublishCriteria()
  return (
    <>
      <PageHeader
        title="Criteria"
        description="Manage the thresholds and finding outcomes used for new match results."
      />
      <p className="mb-6 border bg-muted p-4 text-sm">
        Changing criteria does not change past match results. Saved results
        computed with older criteria are marked out of date.
      </p>
      <CriteriaForm
        current={current}
        publish={(criteria, changeNote) =>
          publish.mutateAsync({ criteria, changeNote })
        }
      />
      <CriteriaHistory versions={versions} />
    </>
  )
}
