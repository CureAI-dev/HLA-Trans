import { useCallback } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { patientListSearch } from "@/features/patients/patients.functions"
import type { PatientListSearch } from "@/features/patients/patients.functions"
import { patientQueries } from "@/features/patients/patients.queries"
import { ABO, CANDIDATE_STATE, URGENCY_STATUS } from "@/domain/options"
import { PageHeader } from "@/components/app/page-header"
import { Pager } from "@/components/app/pager"
import { FilterSelect, ListToolbar, SearchInput } from "@/components/app/list-toolbar"
import { TablePageSkeleton } from "@/components/app/page-skeletons"
import { PatientTable } from "@/components/patient/patient-table"
import { Button } from "@/components/ui/button"

const SORT = [
  { value: "updated", label: "Recently updated" },
  { value: "name", label: "Name" },
  { value: "listed", label: "Recently listed" },
] as const

export const Route = createFileRoute("/patients/")({
  validateSearch: patientListSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(patientQueries.list(deps)),
  head: () => ({ meta: [{ title: "Patients · HLA-Trans" }] }),
  pendingComponent: () => <TablePageSkeleton columns={8} />,
  component: PatientsPage,
})

function PatientsPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data } = useSuspenseQuery(patientQueries.list(search))
  // Any filter change starts again from the first page.
  const set = useCallback(
    (patch: Partial<PatientListSearch>) =>
      void navigate({
        search: (prev) => ({ ...prev, ...patch, cursor: undefined }),
        replace: true,
      }),
    [navigate]
  )
  const setQ = useCallback((q: string) => set({ q: q || undefined }), [set])
  const filtered = Boolean(search.q || search.state || search.abo || search.urgency)
  return (
    <>
      <PageHeader
        title="Patients"
        description="Transplant candidates and their listing status."
        actions={
          <Button nativeButton={false} render={<Link to="/patients/new" />}>
            <Plus aria-hidden="true" />
            Add patient
          </Button>
        }
      />
      <ListToolbar
        canReset={filtered || Boolean(search.sort)}
        onReset={() => void navigate({ search: {}, replace: true })}
      >
        <SearchInput
          label="Search patients"
          placeholder="Name or MRN"
          value={search.q ?? ""}
          onChange={setQ}
        />
        <FilterSelect
          label="Status"
          value={search.state}
          options={CANDIDATE_STATE}
          onChange={(state) => set({ state })}
        />
        <FilterSelect label="ABO" value={search.abo} options={ABO} onChange={(abo) => set({ abo })} />
        <FilterSelect
          label="Urgency"
          value={search.urgency}
          options={URGENCY_STATUS}
          onChange={(urgency) => set({ urgency })}
        />
        <FilterSelect label="Sort" value={search.sort} options={SORT} onChange={(sort) => set({ sort })} />
      </ListToolbar>
      <PatientTable page={data} filtered={filtered} />
      <Pager
        hasCursor={Boolean(search.cursor)}
        nextCursor={data.nextCursor}
        onFirst={() => void navigate({ search: (s) => ({ ...s, cursor: undefined }) })}
        onNext={(cursor) => void navigate({ search: (s) => ({ ...s, cursor }) })}
      />
    </>
  )
}
