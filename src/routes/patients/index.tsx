import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { actions, useDb } from "@/lib/storage/db"
import { PatientTable } from "@/components/patient/patient-table"
import { PageHeader } from "@/components/app/page-header"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"

export const Route = createFileRoute("/patients/")({ component: Patients })
function Patients() {
  const db = useDb()
  const [error, setError] = useState("")
  function load() {
    try {
      actions.loadSampleData()
      toast.add({ title: "Sample data loaded" })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load demo data")
    }
  }
  return (
    <>
      <PageHeader
        title="Patients"
        description="Candidate records and waitlist information."
        actions={
          <a
            className="border bg-primary px-3 py-2 text-primary-foreground"
            href="/patients/new"
          >
            Add patient
          </a>
        }
      />
      {error && <p role="alert">{error}</p>}
      {db.patients.length ? (
        <PatientTable patients={db.patients} />
      ) : (
        <div className="border p-10 text-center">
          <h2 className="text-lg font-semibold">No patient records yet</h2>
          <p className="my-3 text-muted-foreground">
            Add a candidate to begin a compatibility evaluation, or explore with
            synthetic demo data.
          </p>
          <div className="flex justify-center gap-3">
            <a className="border px-3 py-2" href="/patients/new">
              Add patient
            </a>
            <Button onClick={load} variant="outline">
              Load demo data
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
