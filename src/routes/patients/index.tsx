import { Link, createFileRoute } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import { patientListSearch } from "@/features/patients/patients.functions"
import { patientQueries } from "@/features/patients/patients.queries"
import { PageHeader } from "@/components/app/page-header"
import { Pager } from "@/components/app/pager"
import { PatientTable } from "@/components/patient/patient-table"

export const Route = createFileRoute("/patients/")({
  validateSearch: patientListSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(patientQueries.list(deps)),
  head: () => ({ meta: [{ title: "Patients · HLA-Trans" }] }),
  component: PatientsPage,
})

function PatientsPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data } = useSuspenseQuery(patientQueries.list(search))
  return (
    <>
      <PageHeader
        title="Patients"
        description="Transplant candidates and their listing status."
        actions={
          <Link
            className="border bg-primary px-3 py-2 text-primary-foreground"
            to="/patients/new"
          >
            Add patient
          </Link>
        }
      />
      <PatientTable page={data} />
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
