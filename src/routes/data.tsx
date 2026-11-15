import { useRef, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { Download, Upload, Database, Trash2 } from "lucide-react"
import { PageHeader } from "@/components/app/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { validatedDbSchema } from "@/lib/storage/validated-db-schema"
import type { Db } from "@/domain/schema"
import { actions, useDb } from "@/lib/storage/db"

export const Route = createFileRoute("/data")({ component: DataPage })
function DataPage() {
  const db = useDb()
  const [preview, setPreview] = useState<{ name: string; db: Db } | null>(null)
  const [reset, setReset] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [reading, setReading] = useState(false)
  const readVersion = useRef(0)
  function run(operation: () => void, success: string) {
    setError("")
    setMessage("")
    try {
      operation()
      setMessage(success)
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The operation failed. Saved data was not changed."
      )
    }
  }
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
  function exportBackup() {
    run(() => {
      const blob = new Blob([actions.exportDb()], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `hla-trans-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }, "Backup downloaded.")
  }
  return (
    <>
      <PageHeader
        title="Data management"
        description="Back up and manage the database stored in this browser."
      />
      <p className="mb-5 text-sm text-muted-foreground">
        Current database: {db.patients.length} candidates, {db.donors.length}{" "}
        donors, {db.evaluations.length} evaluations. Files are processed locally
        in your browser.
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
          <h2 className="font-semibold">Export backup</h2>
          <p className="my-3 text-sm text-muted-foreground">
            Download all records, saved match results, criteria versions, and
            audit entries as JSON. Keep backups in a secure location.
          </p>
          <Button onClick={exportBackup}>
            <Download />
            Export JSON
          </Button>
        </section>
        <section className="border bg-card p-5">
          <h2 className="font-semibold">Import backup</h2>
          <p id="import-help" className="my-3 text-sm text-muted-foreground">
            Choose a JSON backup. Review its contents before confirming
            replacement of all current data.
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
                  ["Evaluations", preview.db.evaluations.length],
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
                Confirm replacement? Current records and settings will be
                replaced by this backup. Export first if you need to retain
                them.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() =>
                    run(() => {
                      actions.importDb(preview.db)
                      setPreview(null)
                      setReset("")
                    }, "Backup imported. Database replaced.")
                  }
                >
                  <Upload />
                  Confirm replace database
                </Button>
                <Button variant="outline" onClick={() => setPreview(null)}>
                  Cancel import
                </Button>
              </div>
            </div>
          )}
        </section>
        <section className="border bg-card p-5">
          <h2 className="font-semibold">Fictional sample data</h2>
          <p className="my-3 text-sm text-muted-foreground">
            Add fictional candidate and donor records. Repeated loads add no
            duplicate records and preserve existing edits.
          </p>
          <Button
            variant="outline"
            onClick={() =>
              run(
                () => actions.loadSampleData(),
                "Fictional sample records loaded. Existing records were preserved."
              )
            }
          >
            <Database />
            Load sample data
          </Button>
        </section>
        <section className="border bg-card p-5">
          <h2 className="font-semibold">Reset local database</h2>
          <p id="reset-help" className="my-3 text-sm text-muted-foreground">
            Delete all candidates, donors, match results, and previous audit
            entries; restore default criteria and clear the clinician name.
            Export a backup first. Type RESET to confirm.
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
            disabled={reset !== "RESET"}
            onClick={() =>
              run(() => {
                actions.reset()
                setReset("")
                setPreview(null)
                readVersion.current++
                setReading(false)
              }, "Local database reset.")
            }
          >
            <Trash2 />
            Reset database
          </Button>
        </section>
      </div>
    </>
  )
}
