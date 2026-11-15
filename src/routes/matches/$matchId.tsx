import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import { matchQueries } from "@/features/matches/matches.queries"
import { ensureOrNotFound } from "@/lib/route-helpers"
import { PageHeader } from "@/components/app/page-header"
import { ResultView } from "@/components/evaluation/result-view"
import { DecisionForm } from "@/components/evaluation/decision-form"

const rootRoute = getRouteApi("__root__")

export const Route = createFileRoute("/matches/$matchId")({
  loader: ({ context, params }) =>
    ensureOrNotFound(
      context.queryClient.ensureQueryData(matchQueries.detail(params.matchId))
    ),
  head: () => ({ meta: [{ title: "Match result · HLA-Trans" }] }),
  component: MatchResultDetail,
})

function MatchResultDetail() {
  const { matchId } = Route.useParams()
  const { prefs } = rootRoute.useRouteContext()
  const { data: match } = useSuspenseQuery(matchQueries.detail(matchId))
  return (
    <div className="space-y-5">
      <PageHeader
        title="Match result"
        description={`Saved ${new Date(match.createdAt).toLocaleString()} by ${match.createdBy || "Unspecified clinician"}. Patient, donor, pair inputs, criteria and result are frozen.`}
      />
      {match.outOfDate && (
        <p role="note" className="border p-4 text-sm">
          Out of date: the patient, donor or criteria changed after this result
          was saved. Check the pair again for a current result.
        </p>
      )}
      <ResultView
        saved
        result={match.result}
        patient={match.patient}
        donor={match.donor}
        pair={match.pair}
        criteria={match.criteria}
        criteriaVersion={match.criteriaVersion}
      />
      {match.source === "checked" ? (
        <DecisionForm key={match.id} match={match} clinician={prefs.clinician} />
      ) : (
        <p className="border p-4 text-sm">
          This result comes from a match run with default pair inputs. To record
          a decision, check this pair with real pair inputs first.
        </p>
      )}
    </div>
  )
}
