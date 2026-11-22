import { useCallback } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import {
  keepPreviousData,
  useQuery,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { donorListSearch } from "@/features/donors/donors.functions"
import type { DonorListSearch } from "@/features/donors/donors.functions"
import { donorQueries } from "@/features/donors/donors.queries"
import { ABO, DONOR_STATE } from "@/domain/options"
import { KpiStrip, percent } from "@/components/app/kpi-strip"
import type { Kpi } from "@/components/app/kpi-strip"
import { PageHeader } from "@/components/app/page-header"
import { Pager } from "@/components/app/pager"
import { FilterSelect, ListToolbar, SearchInput } from "@/components/app/list-toolbar"
import { TablePageSkeleton } from "@/components/app/page-skeletons"
import { DonorTable } from "@/components/donor/donor-table"
import { Button } from "@/components/ui/button"

/** Short labels keep the toolbar compact; the full names are in the form. */
const DONATION = [
  { value: "dbd", label: "DBD" },
  { value: "dcd", label: "DCD" },
] as const

const SORT = [
  { value: "updated", label: "Recently updated" },
  { value: "code", label: "Donor ID" },
] as const

export const Route = createFileRoute("/donors/")({
  validateSearch: donorListSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    Promise.all([
      context.queryClient.ensureQueryData(donorQueries.list(deps)),
      context.queryClient.ensureQueryData(donorQueries.stats(deps)),
    ]),
  head: () => ({ meta: [{ title: "Donors · Concord" }] }),
  pendingComponent: () => <TablePageSkeleton columns={7} />,
  component: DonorsPage,
})

function DonorsPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data } = useSuspenseQuery(donorQueries.list(search))
  const stats = useQuery({
    ...donorQueries.stats(search),
    placeholderData: keepPreviousData,
  })
  const set = useCallback(
    (patch: Partial<DonorListSearch>) =>
      void navigate({
        search: (prev) => ({ ...prev, ...patch, cursor: undefined }),
        replace: true,
      }),
    [navigate]
  )
  const setQ = useCallback((q: string) => set({ q: q || undefined }), [set])
  const filtered = Boolean(search.q || search.state || search.abo || search.donationType)
  const counts = stats.data
  const toggleState = (state: NonNullable<DonorListSearch["state"]>) => ({
    pressed: search.state === state,
    onToggle: () => set({ state: search.state === state ? undefined : state }),
  })
  const kpis: Kpi[] | null = counts
    ? [
        { label: "Donors", value: counts.total, detail: "matching filters" },
        {
          label: "Available",
          value: counts.available,
          detail: percent(counts.available, counts.total),
          ...toggleState("available"),
        },
        {
          label: "Allocated",
          value: counts.allocated,
          detail: percent(counts.allocated, counts.total),
          ...toggleState("allocated"),
        },
        {
          label: "DCD",
          value: counts.dcd,
          detail: percent(counts.dcd, counts.total),
          pressed: search.donationType === "dcd",
          onToggle: () =>
            set({
              donationType: search.donationType === "dcd" ? undefined : "dcd",
            }),
        },
        {
          label: "Median age",
          value:
            counts.medianAge === null
              ? "–"
              : `${Math.round(counts.medianAge)} y`,
          detail: `${counts.ageReview} aged ${counts.ageReviewAbove} or older`,
        },
      ]
    : null
  return (
    <>
      <PageHeader
        title="Donors"
        description="Donor records. Adding a donor screens it against active candidates."
        actions={
          <Button nativeButton={false} render={<Link to="/donors/new" />}>
            <Plus aria-hidden="true" />
            Add donor
          </Button>
        }
      />
      <ListToolbar
        canReset={filtered || Boolean(search.sort)}
        onReset={() => void navigate({ search: {}, replace: true })}
      >
        <SearchInput
          label="Search donors"
          placeholder="Donor ID or hospital"
          value={search.q ?? ""}
          onChange={setQ}
        />
        <FilterSelect label="State" value={search.state} options={DONOR_STATE} onChange={(state) => set({ state })} />
        <FilterSelect label="ABO" value={search.abo} options={ABO} onChange={(abo) => set({ abo })} />
        <FilterSelect
          label="Donation"
          value={search.donationType}
          options={DONATION}
          onChange={(donationType) => set({ donationType })}
        />
        <FilterSelect label="Sort" value={search.sort} options={SORT} onChange={(sort) => set({ sort })} />
      </ListToolbar>
      <KpiStrip
        label="Donor counts for the current filters"
        items={kpis}
        stale={stats.isPlaceholderData}
      />
      <DonorTable page={data} filtered={filtered} />
      <Pager
        hasCursor={Boolean(search.cursor)}
        nextCursor={data.nextCursor}
        onFirst={() => void navigate({ search: (s) => ({ ...s, cursor: undefined }) })}
        onNext={(cursor) => void navigate({ search: (s) => ({ ...s, cursor }) })}
      />
    </>
  )
}
