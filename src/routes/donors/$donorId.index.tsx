import { useCallback } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import type { LinkOptions } from "@tanstack/react-router"
import {
  keepPreviousData,
  useQuery,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { z } from "zod"
import { donorQueries } from "@/features/donors/donors.queries"
import {
  useDeleteDonor,
  useRerunDonor,
} from "@/features/donors/donors.mutations"
import { matchQueries } from "@/features/matches/matches.queries"
import { matchingQueries } from "@/features/matching/matching.queries"
import { criteriaQueries } from "@/features/criteria/criteria.queries"
import { ensureOrNotFound } from "@/lib/route-helpers"
import { donorRiskFlags } from "@/domain/risk-flags"
import { DONOR_STATE, SEX, labelOf } from "@/domain/options"
import type { Donor } from "@/domain/schema"
import type { RunRow } from "@/domain/match-types"
import { donorRecordSections } from "@/components/record/donor-record"
import { RecordView } from "@/components/record/record-view"
import { DonorDerived } from "@/components/donor/donor-summary"
import { ScreeningResults } from "@/components/donor/screening-results"
import { MatchTable } from "@/components/match/match-table"
import { PageHeader } from "@/components/app/page-header"
import {
  RecordActions,
  toastMatchingStarted,
} from "@/components/app/page-actions"
import { DetailPageSkeleton } from "@/components/app/page-skeletons"
import { FilterSelect, ListToolbar } from "@/components/app/list-toolbar"
import { Pager } from "@/components/app/pager"
import {
  CompletenessCard,
  KeyFacts,
  LatestRunCard,
  OverviewCard,
  RiskFlagsCard,
} from "@/components/app/detail-overview"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/components/ui/toast"

/** Server default page size for match lists (matches.server listMatches). */
const PAGE_SIZE = 50

const detailSearch = z.object({
  tab: z.enum(["overview", "record", "matches"]).optional().catch(undefined),
  view: z.enum(["screening", "all"]).optional().catch(undefined),
  overall: z.enum(["pass", "review", "fail"]).optional().catch(undefined),
  source: z.enum(["screening", "checked"]).optional().catch(undefined),
  cursor: z.string().max(600).optional().catch(undefined),
  /** Page number for rank continuity across keyset pages. */
  page: z.number().int().min(2).max(100_000).optional().catch(undefined),
})
type DetailSearch = z.infer<typeof detailSearch>

const donorRuns = (donorId: string) =>
  ({ subjectKind: "donor", subjectId: donorId }) as const
const RUN_STATE: Partial<Record<RunRow["status"], string>> = {
  queued: "This match run is queued; results appear as pairs are processed.",
  running:
    "This match run is still running; the list grows as pairs are processed.",
  cancelled: "This match run was cancelled; results are partial.",
  failed: "This match run failed; results are partial.",
}

const OVERALL = [
  { value: "pass", label: "PASS" },
  { value: "review", label: "REVIEW" },
  { value: "fail", label: "FAIL" },
] as const
const SOURCE = [
  { value: "screening", label: "Screening" },
  { value: "checked", label: "Checked pair" },
] as const
const VIEW = [
  { value: "screening", label: "Latest run · screening order" },
  { value: "all", label: "All results · newest first" },
] as const

/** Fields matching depends on: listed first among missing data. */
const DONOR_PRIORITY = [
  "blood.abo",
  "identity.ageYears",
  "identity.sex",
  "body.heightCm",
  "body.weightKg",
  "echo.lvef",
  "echo.echoDate",
  "death.cardiacArrest",
  "hla.A",
  "hla.B",
  "hla.DRB1",
  "infection.serology.hivNat",
  "infection.serology.hcvNat",
  "infection.serology.hbvNat",
  "labs.sodiumLatest",
]

/** Conditional fields count only when they apply to this donor. */
const donorFieldApplies = (d: Donor) => (path: string) => {
  switch (path) {
    case "notes":
      return false
    case "donation.brainDeathDate":
      return d.donation.type === "dbd"
    case "donation.dcdRecovery":
    case "donation.agonalPhaseMinutes":
    case "donation.functionalWarmIschemiaMinutes":
    case "donation.noTouchMinutes":
      return d.donation.type === "dcd"
    case "death.carboxyhemoglobinPct":
      return d.death.carbonMonoxidePoisoning
    case "death.cprMinutes":
      return d.death.cardiacArrest === "yes"
    case "history.malignancyDetail":
      return d.history.malignancyRisk !== "none"
    default:
      return true
  }
}

const KEY_FACTS = [
  "death.cause",
  "death.mechanism",
  "death.cardiacArrest",
  "death.cprMinutes",
  "echo.lvef",
  "echo.repeatLvef",
  "echo.echoDate",
  "hemodynamics.vasoactives",
  "labs.troponinIPeak",
  "labs.troponinTPeak",
  "labs.sodiumLatest",
]

export const Route = createFileRoute("/donors/$donorId/")({
  validateSearch: detailSearch,
  loader: async ({ context, params }) => {
    const qc = context.queryClient
    // Not awaited: secondary cards stream in after the record.
    void qc.prefetchQuery(matchingQueries.history(donorRuns(params.donorId)))
    await Promise.all([
      ensureOrNotFound(qc.ensureQueryData(donorQueries.detail(params.donorId))),
      qc.ensureQueryData(criteriaQueries.latest()),
    ])
  },
  pendingComponent: DetailPageSkeleton,
  component: DonorDetail,
})

function DonorDetail() {
  const { donorId } = Route.useParams()
  const search = Route.useSearch()
  const navigate = useNavigate()
  const routeNavigate = Route.useNavigate()
  const {
    data: { record: donor },
  } = useSuspenseQuery(donorQueries.detail(donorId))
  const { data: criteria } = useSuspenseQuery(criteriaQueries.latest())
  const del = useDeleteDonor()
  const rerun = useRerunDonor()
  const openRun = useCallback(
    (runId: string): LinkOptions => ({
      to: "/matching/$runId",
      params: { runId },
    }),
    []
  )
  const onRerun = () =>
    rerun.mutate(donorId, {
      onSuccess: ({ runId }) =>
        toastMatchingStarted(() => void navigate(openRun(runId))),
    })
  const editLink: LinkOptions = {
    to: "/donors/$donorId/edit",
    params: { donorId },
  }
  const id = donor.identity
  const flags = donorRiskFlags(donor, criteria.criteria)
  return (
    <>
      <PageHeader
        title={id.donorId || "Unnamed donor"}
        titleClassName="font-mono"
        breadcrumbs={[
          { label: "Donors", link: { to: "/donors" } },
          { label: id.donorId || donorId },
        ]}
        badges={
          <>
            <Badge variant="outline">{labelOf(DONOR_STATE, id.state)}</Badge>
            <Badge variant="outline">
              ABO {donor.blood.abo ?? "not recorded"}
            </Badge>
            <Badge variant="outline">
              {id.ageYears === null ? "Age not recorded" : `${id.ageYears} y`} ·{" "}
              {labelOf(SEX, id.sex)}
            </Badge>
            <Badge variant="outline">{donor.donation.type.toUpperCase()}</Badge>
          </>
        }
        description={[
          id.donorHospital || "Hospital not recorded",
          id.opo || "OPO not recorded",
          id.referralDate
            ? `referred ${id.referralDate}`
            : "referral date not recorded",
        ].join(" · ")}
        actions={
          <RecordActions
            entityLabel="donor"
            editLink={editLink}
            checkLink={{ to: "/matches/check", search: { donorId } }}
            onRerun={onRerun}
            rerunPending={rerun.isPending}
            deletePending={del.isPending}
            onDelete={async () => {
              await del.mutateAsync(donorId)
              toast.add({ title: "Donor deleted" })
              void navigate({ to: "/donors" })
            }}
          />
        }
      />
      <Tabs
        value={search.tab ?? "overview"}
        onValueChange={(tab) =>
          void routeNavigate({
            search: (prev) => ({
              ...prev,
              tab:
                tab === "overview" ? undefined : (tab as DetailSearch["tab"]),
            }),
            replace: true,
          })
        }
      >
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="record">Clinical record</TabsTrigger>
          <TabsTrigger value="matches">Matches</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <OverviewCard title="Key facts">
                <KeyFacts
                  sections={donorRecordSections}
                  record={donor}
                  paths={KEY_FACTS}
                />
              </OverviewCard>
              <OverviewCard title="Derived values">
                <DonorDerived donor={donor} />
              </OverviewCard>
            </div>
            <div className="space-y-4">
              <RiskFlagsCard flags={flags} editLink={editLink} />
              <CompletenessCard
                sections={donorRecordSections}
                record={donor}
                priority={DONOR_PRIORITY}
                relevant={donorFieldApplies(donor)}
                editLink={editLink}
              />
              <LatestRunCard
                subjectKind="donor"
                subjectId={donorId}
                onRerun={onRerun}
                rerunPending={rerun.isPending}
                openLink={openRun}
              />
            </div>
          </div>
        </TabsContent>
        <TabsContent value="record">
          <RecordView
            sections={donorRecordSections}
            record={donor}
            editLink={editLink}
          />
        </TabsContent>
        <TabsContent value="matches">
          <DonorMatches donor={donor} search={search} />
        </TabsContent>
      </Tabs>
    </>
  )
}

function DonorMatches({
  donor,
  search,
}: {
  donor: Donor
  search: DetailSearch
}) {
  const navigate = Route.useNavigate()
  const donorId = donor.id
  const view = search.view ?? "screening"
  const set = (patch: Partial<DetailSearch>) =>
    void navigate({
      search: (prev) => ({
        ...prev,
        ...patch,
        cursor: undefined,
        page: undefined,
      }),
      replace: true,
    })
  // Shares the Latest matching card's query. The newest run that produced
  // results (a cancelled or running run still has partial results).
  const runs = useQuery({
    ...matchingQueries.history(donorRuns(donorId)),
    enabled: view === "screening",
  })
  const run =
    runs.data?.items.find((r) => r.processed > 0 || r.status === "succeeded") ??
    runs.data?.items[0]
  const live = run?.status === "queued" || run?.status === "running"
  const screening = useQuery({
    ...matchQueries.list({
      donorId,
      runId: run?.id,
      order: "screen",
      overall: search.overall,
      cursor: search.cursor,
    }),
    enabled: view === "screening" && Boolean(run),
    placeholderData: keepPreviousData,
    refetchInterval: live ? 2_000 : false,
  })
  const all = useQuery({
    ...matchQueries.list({
      donorId,
      order: "recent",
      overall: search.overall,
      source: search.source,
      cursor: search.cursor,
    }),
    enabled: view === "all",
    placeholderData: keepPreviousData,
  })
  const page = view === "screening" ? screening : all
  const loading =
    view === "screening"
      ? runs.isPending || (Boolean(run) && screening.isPending)
      : all.isPending
  const filtered = Boolean(search.overall || search.source || search.view)
  return (
    <>
      <ListToolbar
        canReset={filtered}
        onReset={() =>
          set({ view: undefined, overall: undefined, source: undefined })
        }
      >
        <Select
          items={VIEW}
          value={view}
          onValueChange={(v) =>
            set({ view: v === "all" ? "all" : undefined, source: undefined })
          }
        >
          <SelectTrigger aria-label="View" className="w-auto min-w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VIEW.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FilterSelect
          label="Result"
          value={search.overall}
          options={OVERALL}
          onChange={(overall) => set({ overall })}
        />
        {view === "all" && (
          <FilterSelect
            label="Source"
            value={search.source}
            options={SOURCE}
            onChange={(source) => set({ source })}
          />
        )}
      </ListToolbar>
      {view === "screening" && run && RUN_STATE[run.status] && (
        <p role="status" className="mb-3 text-sm text-muted-foreground">
          {RUN_STATE[run.status]}
        </p>
      )}
      {loading ? (
        <Skeleton className="h-64 w-full" aria-label="Loading match results" />
      ) : view === "screening" ? (
        <ScreeningResults
          donorId={donorId}
          rows={run ? (screening.data?.items ?? []) : []}
          rankOffset={((search.page ?? 1) - 1) * PAGE_SIZE}
          criteriaVersion={run?.criteriaVersion}
          emptyText={
            run
              ? "No candidates in this group for this match run."
              : "Results appear when this donor's match run finishes. Add or activate candidates to include them."
          }
        />
      ) : (
        <MatchTable
          rows={all.data?.items ?? []}
          showDonor={false}
          emptyText={
            filtered
              ? "No results match these filters."
              : "No saved results for this donor yet."
          }
        />
      )}
      <Pager
        hasCursor={Boolean(search.cursor)}
        nextCursor={page.data?.nextCursor ?? null}
        onFirst={() =>
          void navigate({
            search: (s) => ({ ...s, cursor: undefined, page: undefined }),
          })
        }
        onNext={(cursor) =>
          void navigate({
            search: (s) => ({ ...s, cursor, page: (s.page ?? 1) + 1 }),
          })
        }
      />
    </>
  )
}
