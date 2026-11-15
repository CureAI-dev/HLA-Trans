import { useEffect, useRef, useState } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Download, Upload, Database, Trash2 } from "lucide-react"
import { PageHeader } from "@/components/app/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { validatedDbSchema } from "@/domain/backup-schema"
import type { Db } from "@/domain/schema"
import {
  exportDataFn,
  importDataFn,
  resetDataFn,
  seedDemoFn,
} from "@/features/data/data.functions"
import { deleteLegacyData, hasLegacyData } from "@/lib/legacy-import"

export const Route = createFileRoute("/data")({
  head: () => ({ meta: [{ title: "Data · HLA-Trans" }] }),
  component: DataPage,
})

const failed = (e: unknown) =>
  e instanceof Error ? e.message : "The operation failed. Saved data was not changed."

function DataPage() {
  const qc = useQueryClient()
  const router = useRouter()
  const [preview, setPreview] = useState<{ name: string; db: Db } | null>(null)
  const [reset, setReset] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [reading, setReading] = useState(false)
  const [legacy, setLegacy] = useState(false)
  useEffect(() => setLegacy(hasLegacyData()), []) // client only
  const readVersion = useRef(0)
  const clearStatus = () => {
    setError("")
    setMessage("")
  }
  const exporter = useMutation({
    mutationKey: ["data", "export"],
    meta: { errorTitle: "Export failed" },
    mutationFn: () =>
      qc.fetchQuery({
        queryKey: ["data", "export"],
        queryFn: () => exportDataFn(),
        staleTime: 0,
      }),
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `hla-trans-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setMessage("Export downloaded.")
    },
    onError: (e) => setError(failed(e)),
  })
  const importer = useMutation({
    mutationKey: ["data", "import"],
    meta: { errorTitle: "Import failed" },
    mutationFn: (backup: unknown) => importDataFn({ data: { backup } }),
    onSuccess: (s) => {
      setPreview(null)
      setMessage(
        `Imported ${s.patients} patients, ${s.donors} donors, ${s.matches} match results and ${s.decisions} decisions. ${s.skipped} existing match results were skipped.`
      )
      void qc.invalidateQueries()
    },
    onError: (e) => setError(failed(e)),
  })
  const seeder = useMutation({
    mutationKey: ["data", "seed"],
    meta: { errorTitle: "Demo data not loaded" },
    mutationFn: () => seedDemoFn(),
    onSuccess: (r) => {
      toast.add({
        title: `Demo data loaded. Matching started for ${r.runs} donors.`,
      })
      setMessage(
        `Added ${r.patients} patients and ${r.donors} donors. Existing records were kept.`
      )
      void qc.invalidateQueries()
    },
    onError: (e) => setError(failed(e)),
  })
  const resetter = useMutation({
    mutationKey: ["data", "reset"],
    meta: { errorTitle: "Database not reset" },
    mutationFn: () => resetDataFn({ data: { confirm: "RESET" } }),
    onSuccess: () => {
      setReset("")
      setPreview(null)
      readVersion.current++
      setReading(false)
      setMessage("Database reset.")
      qc.clear()
      void router.invalidate()
    },
    onError: (e) => setError(failed(e)),
  })
  async function readFile(file: File | undefined) {
    const version = ++readVersion.current
    setPreview(null)
    setError("")
    setMessage("")
    if (!file) {
      setReading(false)
      return
    }
    setReading(true)
    try {
      const parsed: unknown = JSON.parse(await file.text())
      const result = validatedDbSchema.safeParse(parsed)
      if (!result.success)
        throw new Error(
          `Invalid backup: ${result.error.issues[0]?.message ?? "database schema mismatch"}`
        )
      if (version === readVersion.current)
        setPreview({ name: file.name, db: result.data })
    } catch (e) {
      if (version === readVersion.current)
        setError(
          e instanceof SyntaxError
            ? "Invalid JSON file. Existing data has not changed."
            : e instanceof Error
              ? e.message
              : "Unable to read this file."
        )
    } finally {
      if (version === readVersion.current) setReading(false)
    }
  }
  return (
    <>
      <PageHeader
        title="Data management"
        description="Export, import, seed and reset the shared database."
      />
      <p className="mb-5 text-sm text-muted-foreground">
        Exports contain patient and donor records and the criteria history. For
        a full database backup use <code>pg_dump</code> (see README).
      </p>
      {error && (
        <p role="alert" className="mb-5 border p-4">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mb-5 border p-4">
          {message}
        </p>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="border bg-card p-5">
          <h2 className="font-semibold">Export</h2>
          <p className="my-3 text-sm text-muted-foreground">
            Download current patient and donor records, the criteria history and
            an index of saved match results as JSON, for human review. Keep
            exports in a secure location.
          </p>
          <Button
            disabled={exporter.isPending}
            onClick={() => {
              clearStatus()
              exporter.mutate()
            }}
          >
            {exporter.isPending ? <Spinner /> : <Download />}
            Export JSON
          </Button>
        </section>
        <section className="border bg-card p-5">
          <h2 className="font-semibold">Import backup</h2>
          <p id="import-help" className="my-3 text-sm text-muted-foreground">
            Choose a backup from the previous browser-based version (v1
            format). Records are added to the shared database; existing
            records with the same id are never overwritten.
          </p>
          <label className="block space-y-2 text-sm">
            Backup JSON file
            <Input
              type="file"
              accept=".json,application/json"
              aria-describedby="import-help"
              onChange={(e) => void readFile(e.target.files?.[0])}
            />
          </label>
          {reading && (
            <p role="status" className="mt-3">
              Validating backup -
            </p>
          )}
          {preview && (
            <div className="mt-4 space-y-3 border p-4">
              <h3 className="font-semibold break-all">
                Validated backup: {preview.name}
              </h3>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                {[
                  ["Candidates", preview.db.patients.length],
                  ["Donors", preview.db.donors.length],
                  ["Match results", preview.db.evaluations.length],
                  ["Criteria versions", preview.db.criteriaVersions.length],
                  ["Audit entries", preview.db.audit.length],
                ].map(([label, count]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd className="font-semibold tabular-nums">{count}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-sm">
                Import these records? Records already in the database are
                skipped, so importing twice adds nothing.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={importer.isPending}
                  onClick={() => {
                    clearStatus()
                    importer.mutate(preview.db)
                  }}
                >
                  {importer.isPending ? <Spinner /> : <Upload />}
                  Import records
                </Button>
                <Button variant="outline" onClick={() => setPreview(null)}>
                  Cancel import
                </Button>
              </div>
            </div>
          )}
        </section>
        <section className="border bg-card p-5">
          <h2 className="font-semibold">Synthetic demo data</h2>
          <p className="my-3 text-sm text-muted-foreground">
            Add synthetic candidate and donor records and start matching for
            each available donor. Repeated loads add no duplicate records and
            preserve existing edits.
          </p>
          <Button
            variant="outline"
            disabled={seeder.isPending}
            onClick={() => {
              clearStatus()
              seeder.mutate()
            }}
          >
            {seeder.isPending ? <Spinner /> : <Database />}
            Load demo dataset
          </Button>
        </section>
        <section className="border bg-card p-5">
          <h2 className="font-semibold">Reset database</h2>
          <p id="reset-help" className="my-3 text-sm text-muted-foreground">
            Delete all patients, donors, match runs, match results, decisions
            and previous audit entries for everyone using this database, and
            restore the default criteria. Take a <code>pg_dump</code> first.
            Type RESET to confirm.
          </p>
          <label className="block space-y-2 text-sm">
            Reset confirmation
            <Input
              value={reset}
              onChange={(e) => setReset(e.target.value)}
              aria-describedby="reset-help"
              autoComplete="off"
            />
          </label>
          <Button
            className="mt-3"
            variant="outline"
            disabled={reset !== "RESET" || resetter.isPending}
            onClick={() => {
              clearStatus()
              resetter.mutate()
            }}
          >
            {resetter.isPending ? <Spinner /> : <Trash2 />}
            Reset database
          </Button>
        </section>
        {legacy && (
          <section className="border bg-card p-5">
            <h2 className="font-semibold">Browser copy</h2>
            <p className="my-3 text-sm text-muted-foreground">
              This browser still holds records from the previous version. Delete
              that copy once it has been imported.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                deleteLegacyData()
                setLegacy(false)
                setMessage("Browser copy deleted.")
              }}
            >
              <Trash2 />
              Delete browser copy
            </Button>
          </section>
        )}
      </div>
    </>
  )
}
