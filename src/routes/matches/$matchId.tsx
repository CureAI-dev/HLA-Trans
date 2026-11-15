import { createFileRoute, getRouteApi, useNavigate } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import { matchQueries } from "@/features/matches/matches.queries"
import { ensureOrNotFound } from "@/lib/route-helpers"
import { PageHeader } from "@/components/app/page-header"
import { ResultPageSkeleton } from "@/components/app/page-skeletons"
import { ResultView } from "@/components/match/result-view"
import { DecisionPanel } from "@/components/match/decision-panel"

const rootRoute = getRouteApi("__root__")

export const Route = createFileRoute("/matches/$matchId")({
  loader: ({ context, params }) =>
    ensureOrNotFound(
      context.queryClient.ensureQueryData(matchQueries.detail(params.matchId))
    ),
  head: () => ({ meta: [{ title: "Match result · HLA-Trans" }] }),
  pendingComponent: ResultPageSkeleton,
  component: MatchResultDetail,
})

function MatchResultDetail() {
  const { matchId } = Route.useParams()
  const { prefs } = rootRoute.useRouteContext()
  const navigate = useNavigate()
  const { data: match } = useSuspenseQuery(matchQueries.detail(matchId))
  return (
    <>
      <PageHeader
        title="Match result"
        breadcrumbs={[
          { label: "Match results", link: { to: "/matches" } },
          { label: "Match result" },
        ]}
      />
      <ResultView
        key={match.id}
        detail={match}
        mode="saved"
        onPairFix={() =>
          void navigate({
            to: "/matches/check",
            search: { patientId: match.patientId, donorId: match.donorId },
            hash: "pair-inputs",
          })
        }
        aside={<DecisionPanel detail={match} clinician={prefs.clinician} />}
      />
    </>
  )
}
