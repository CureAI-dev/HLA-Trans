import { Link, createFileRoute } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import { donorListSearch } from "@/features/donors/donors.functions"
import { donorQueries } from "@/features/donors/donors.queries"
import { PageHeader } from "@/components/app/page-header"
import { Pager } from "@/components/app/pager"
import { DonorTable } from "@/components/donor/donor-table"

export const Route = createFileRoute("/donors/")({
  validateSearch: donorListSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(donorQueries.list(deps)),
  head: () => ({ meta: [{ title: "Donors · HLA-Trans" }] }),
  component: DonorsPage,
})

function DonorsPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data } = useSuspenseQuery(donorQueries.list(search))
  return (
    <>
      <PageHeader
        title="Donors"
        description="Donor records. Adding a donor screens it against active candidates."
        actions={
          <Link className="border px-3 py-2" to="/donors/new">
            Add donor
          </Link>
        }
      />
      <DonorTable page={data} />
      <Pager
        hasCursor={Boolean(search.cursor)}
        nextCursor={data.nextCursor}
        onFirst={() =>
          void navigate({ search: (s) => ({ ...s, cursor: undefined }) })
        }
        onNext={(cursor) => void navigate({ search: (s) => ({ ...s, cursor }) })}
      />
    </>
  )
}
