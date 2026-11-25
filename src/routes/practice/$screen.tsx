import { createFileRoute, getRouteApi, notFound } from "@tanstack/react-router"
import { z } from "zod"
import { DECISION_VERDICT_VALUES } from "@/domain/options"
import { DetailPageSkeleton } from "@/components/app/page-skeletons"
import {
  PracticeDonor,
  PracticePatient,
  PracticeResult,
  PracticeRun,
} from "@/features/guide/components/practice-screens"

/** Demo screens for the tutorials. All state is in the URL; nothing is read or saved. */
const practiceSearch = z.object({
  tab: z
    .enum(["overview", "record", "matches", "findings", "compare"])
    .optional()
    .catch(undefined),
  menu: z.boolean().optional().catch(undefined),
  mode: z.enum(["screening", "checked"]).optional().catch(undefined),
  ood: z.boolean().optional().catch(undefined),
  verdict: z.enum(DECISION_VERDICT_VALUES).optional().catch(undefined),
})
const SCREENS = ["patient", "donor", "run", "result"]
const rootRoute = getRouteApi("__root__")

export const Route = createFileRoute("/practice/$screen")({
  validateSearch: practiceSearch,
  beforeLoad: ({ params }) => {
    if (!SCREENS.includes(params.screen)) throw notFound()
  },
  head: () => ({ meta: [{ title: "Practice · Concord" }] }),
  pendingComponent: DetailPageSkeleton,
  component: PracticePage,
})

function PracticePage() {
  const { screen } = Route.useParams()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { user } = rootRoute.useRouteContext()
  switch (screen) {
    case "patient":
      return (
        <PracticePatient
          tab={
            search.tab === "record" || search.tab === "matches"
              ? search.tab
              : "overview"
          }
          menu={search.menu ?? false}
          onTab={(tab) => void navigate({ search: { tab }, replace: true })}
        />
      )
    case "donor":
      return <PracticeDonor />
    case "run":
      return <PracticeRun />
    default: {
      const mode = search.mode ?? "screening"
      const outOfDate = search.ood ?? false
      return (
        <PracticeResult
          // The decision keeps what was chosen, so `verdict` and `tab` do not remount it.
          key={`${mode}:${outOfDate}`}
          mode={mode}
          outOfDate={outOfDate}
          tab={search.tab === "compare" ? "compare" : "findings"}
          verdict={search.verdict}
          clinician={user?.name ?? ""}
        />
      )
    }
  }
}
