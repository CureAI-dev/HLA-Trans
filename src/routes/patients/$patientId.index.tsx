import { useCallback } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import type { LinkOptions } from "@tanstack/react-router"
import {
  keepPreviousData,
  useQuery,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { z } from "zod"
import { patientQueries } from "@/features/patients/patients.queries"
import {
  useDeletePatient,
  useRerunPatient,
} from "@/features/patients/patients.mutations"
import { matchQueries } from "@/features/matches/matches.queries"
import { matchingQueries } from "@/features/matching/matching.queries"
import { criteriaQueries } from "@/features/criteria/criteria.queries"
import { ensureOrNotFound } from "@/lib/route-helpers"
import { patientRiskFlags } from "@/domain/risk-flags"
import { ageInYears } from "@/domain/calc"
import { CANDIDATE_STATE, SEX, URGENCY_STATUS, labelOf } from "@/domain/options"
import type { Patient } from "@/domain/schema"
import { patientRecordSections } from "@/components/record/patient-record"
import { RecordView } from "@/components/record/record-view"
import {
  PatientDerived,
  PatientHemodynamics,
} from "@/components/patient/patient-summary"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/components/ui/toast"

const detailSearch = z.object({
  tab: z.enum(["overview", "record", "matches"]).optional().catch(undefined),
  overall: z.enum(["pass", "review", "fail"]).optional().catch(undefined),
  source: z.enum(["screening", "checked"]).optional().catch(undefined),
  cursor: z.string().max(600).optional().catch(undefined),
})
type DetailSearch = z.infer<typeof detailSearch>

const OVERALL = [
  { value: "pass", label: "PASS" },
  { value: "review", label: "REVIEW" },
  { value: "fail", label: "FAIL" },
] as const
const SOURCE = [
  { value: "screening", label: "Screening" },
  { value: "checked", label: "Checked pair" },
] as const

/** Fields matching depends on: listed first among missing data. */
const PATIENT_PRIORITY = [
  "blood.abo",
  "identity.dateOfBirth",
  "identity.sex",
  "body.heightCm",
  "body.weightKg",
  "listing.urgencyStatus",
  "listing.listingDate",
  "listing.statusDate",
  "sensitization.cpra",
  "hemodynamics.paSystolic",
  "hemodynamics.paDiastolic",
  "hemodynamics.pcwp",
  "hemodynamics.cardiacOutput",
  "hla.A",
  "hla.B",
  "hla.DRB1",
  "serology.hcvNat",
]

/** Conditional fields count only when they apply to this patient. */
const patientFieldApplies = (p: Patient) => (path: string) => {
  switch (path) {
    case "notes":
      return false
    case "listing.otherOrgans":
      return p.listing.multiOrgan
    case "blood.antiATiter":
    case "blood.antiBTiter":
    case "blood.titerDate":
    case "blood.titerLoweringTherapyWithin30Days":
      return p.blood.acceptsIncompatible
    case "hemodynamics.pvrAfterChallenge":
      return p.hemodynamics.vasodilatorChallengeDone
    case "support.deviceBrand":
    case "support.deviceImplantDate":
      return p.support.device !== "none"
    case "history.malignancyDetail":
      return p.history.malignancyHistory === "yes"
    default:
      return true
  }
}

const KEY_FACTS = [
  "identity.dateOfBirth",
  "listing.listingDate",
  "listing.statusDate",
  "listing.statusExpiresOn",
  "diagnosis.primary",
  "support.device",
  "sensitization.cpra",
  "function.lvef",
  "body.heightCm",
  "body.weightKg",
]

export const Route = createFileRoute("/patients/$patientId/")({
  validateSearch: detailSearch,
  loader: async ({ context, params }) => {
    const qc = context.queryClient
    // Not awaited: secondary cards stream in after the record.
    void qc.prefetchQuery(
      matchingQueries.history({
        subjectKind: "patient",
        subjectId: params.patientId,
      })
    )
    void qc.prefetchQuery(
      matchQueries.list({ patientId: params.patientId, order: "recent" })
    )
    await Promise.all([
      ensureOrNotFound(
        qc.ensureQueryData(patientQueries.detail(params.patientId))
      ),
      qc.ensureQueryData(criteriaQueries.latest()),
    ])
  },
  pendingComponent: DetailPageSkeleton,
  component: PatientDetail,
})

function PatientDetail() {
  const { patientId } = Route.useParams()
  const search = Route.useSearch()
  const navigate = useNavigate()
  const routeNavigate = Route.useNavigate()
  const {
    data: { record: p },
  } = useSuspenseQuery(patientQueries.detail(patientId))
  const { data: criteria } = useSuspenseQuery(criteriaQueries.latest())
  const del = useDeletePatient()
  const rerun = useRerunPatient()
  const openRun = useCallback(
    (runId: string): LinkOptions => ({
      to: "/matching/$runId",
      params: { runId },
    }),
    []
  )
  const onRerun = () =>
    rerun.mutate(patientId, {
      onSuccess: ({ runId }) =>
        toastMatchingStarted(() => void navigate(openRun(runId))),
    })
  const editLink: LinkOptions = {
    to: "/patients/$patientId/edit",
    params: { patientId },
  }
  const id = p.identity
  const name = `${id.firstName} ${id.lastName}`.trim() || "Unnamed patient"
  const age = ageInYears(id.dateOfBirth)
  const flags = patientRiskFlags(p, new Date(), criteria.criteria)
  return (
    <>
      <PageHeader
        title={name}
        breadcrumbs={[
          { label: "Patients", link: { to: "/patients" } },
          { label: name },
        ]}
        badges={
          <>
            <Badge variant="outline">
              {labelOf(CANDIDATE_STATE, p.listing.state)}
            </Badge>
            <Badge variant="outline">
              {p.listing.urgencyStatus
                ? labelOf(URGENCY_STATUS, p.listing.urgencyStatus)
                : "Urgency not recorded"}
            </Badge>
            <Badge variant="outline">ABO {p.blood.abo ?? "not recorded"}</Badge>
            <Badge variant="outline">
              {age === null ? "Age not recorded" : `${age} y`} ·{" "}
              {labelOf(SEX, id.sex)}
            </Badge>
          </>
        }
        description={[
          `MRN ${id.mrn || "not recorded"}`,
          id.transplantCenter || "Center not recorded",
          p.listing.listingDate
            ? `listed ${p.listing.listingDate}`
            : "listing date not recorded",
        ].join(" · ")}
        actions={
          <RecordActions
            entityLabel="patient"
            editLink={editLink}
            checkLink={{ to: "/matches/check", search: { patientId } }}
            onRerun={onRerun}
            rerunPending={rerun.isPending}
            deletePending={del.isPending}
            onDelete={async () => {
              await del.mutateAsync(patientId)
              toast.add({ title: "Patient deleted" })
              void navigate({ to: "/patients" })
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
                  sections={patientRecordSections}
                  record={p}
                  paths={KEY_FACTS}
                />
              </OverviewCard>
              <OverviewCard title="Derived values">
                <div className="grid gap-3">
                  <PatientDerived patient={p} />
                  <PatientHemodynamics patient={p} />
                </div>
              </OverviewCard>
            </div>
            <div className="space-y-4">
              <RiskFlagsCard flags={flags} editLink={editLink} />
              <CompletenessCard
                sections={patientRecordSections}
                record={p}
                priority={PATIENT_PRIORITY}
                relevant={patientFieldApplies(p)}
                editLink={editLink}
              />
              <LatestRunCard
                subjectKind="patient"
                subjectId={patientId}
                onRerun={onRerun}
                rerunPending={rerun.isPending}
                openLink={openRun}
              />
            </div>
          </div>
        </TabsContent>
        <TabsContent value="record">
          <RecordView
            sections={patientRecordSections}
            record={p}
            editLink={editLink}
          />
        </TabsContent>
        <TabsContent value="matches">
          <PatientMatches patientId={patientId} search={search} />
        </TabsContent>
      </Tabs>
    </>
  )
}

function PatientMatches({
  patientId,
  search,
}: {
  patientId: string
  search: DetailSearch
}) {
  const navigate = Route.useNavigate()
  const set = (patch: Partial<DetailSearch>) =>
    void navigate({
      search: (prev) => ({ ...prev, ...patch, cursor: undefined }),
      replace: true,
    })
  const results = useQuery({
    ...matchQueries.list({
      patientId,
      order: "recent",
      overall: search.overall,
      source: search.source,
      cursor: search.cursor,
    }),
    placeholderData: keepPreviousData,
  })
  const filtered = Boolean(search.overall || search.source)
  return (
    <>
      <ListToolbar
        canReset={filtered}
        onReset={() => set({ overall: undefined, source: undefined })}
      >
        <FilterSelect
          label="Result"
          value={search.overall}
          options={OVERALL}
          onChange={(overall) => set({ overall })}
        />
        <FilterSelect
          label="Source"
          value={search.source}
          options={SOURCE}
          onChange={(source) => set({ source })}
        />
      </ListToolbar>
      {results.isPending ? (
        <Skeleton className="h-64 w-full" aria-label="Loading match results" />
      ) : (
        <MatchTable
          rows={results.data?.items ?? []}
          showPatient={false}
          emptyText={
            filtered
              ? "No results match these filters."
              : "Results appear when matching runs or a pair is checked for this patient."
          }
        />
      )}
      <Pager
        hasCursor={Boolean(search.cursor)}
        nextCursor={results.data?.nextCursor ?? null}
        onFirst={() =>
          void navigate({ search: (s) => ({ ...s, cursor: undefined }) })
        }
        onNext={(cursor) =>
          void navigate({ search: (s) => ({ ...s, cursor }) })
        }
      />
    </>
  )
}
