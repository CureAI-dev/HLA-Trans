import { useCallback } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { donorListSearch } from "@/features/donors/donors.functions"
import type { DonorListSearch } from "@/features/donors/donors.functions"
import { donorQueries } from "@/features/donors/donors.queries"
import { ABO, DONOR_STATE } from "@/domain/options"
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
    context.queryClient.ensureQueryData(donorQueries.list(deps)),
  head: () => ({ meta: [{ title: "Donors · Concord" }] }),
  pendingComponent: () => <TablePageSkeleton columns={7} />,
  component: DonorsPage,
})

function DonorsPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data } = useSuspenseQuery(donorQueries.list(search))
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
