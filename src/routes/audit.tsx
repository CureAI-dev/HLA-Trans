import { useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { PageHeader } from "@/components/app/page-header"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { auditEntrySchema } from "@/domain/schema"
import { useDb } from "@/lib/storage/db"

export const Route = createFileRoute("/audit")({ component: AuditPage })
function AuditPage() {
  const db = useDb()
  const [action, setAction] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [text, setText] = useState("")
  const invalidRange = Boolean(from && to && from > to)
  const records = [...db.audit]
    .filter((e) => {
      const date = new Date(e.at)
      const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
      return (
        (!action || e.action === action) &&
        (!from || day >= from) &&
        (!to || day <= to) &&
        `${e.actor} ${e.action} ${e.subjectId} ${e.summary}`
          .toLowerCase()
          .includes(text.trim().toLowerCase())
      )
    })
    .sort((a, b) => b.at.localeCompare(a.at))
  return (
    <>
      <PageHeader
        title="Audit log"
        description="Local record of changes, match results, decisions, and data operations."
      />
      <div className="mb-5 grid items-end gap-4 border bg-card p-4 sm:grid-cols-2 xl:grid-cols-5">
        <label className="space-y-2 text-sm">
          Action
          <select
            aria-label="Action"
            className="h-8 w-full border bg-background px-2"
            value={action}
            onChange={(e) => setAction(e.target.value)}
          >
            <option value="">All actions</option>
            {auditEntrySchema.shape.action.options.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm">
          From date
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            aria-describedby={invalidRange ? "date-error" : undefined}
          />
        </label>
        <label className="space-y-2 text-sm">
          Through date
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            aria-describedby={invalidRange ? "date-error" : undefined}
          />
        </label>
        <label className="space-y-2 text-sm">
          Search audit text
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Actor, subject, or summary"
          />
        </label>
        <Button
          variant="outline"
          onClick={() => {
            setAction("")
            setFrom("")
            setTo("")
            setText("")
          }}
        >
          Clear filters
        </Button>
      </div>
      {invalidRange && (
        <p id="date-error" role="alert" className="mb-4">
          From date must be on or before through date.
        </p>
      )}
      <p className="mb-3 text-sm" aria-live="polite">
        {records.length} matching entries - Dates use your local time.
      </p>
      {records.length ? (
        <div className="overflow-x-auto border">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              Filtered audit entries, newest first
            </caption>
            <thead className="bg-muted">
              <tr>
                {["Time", "Actor", "Action", "Subject", "Summary"].map((h) => (
                  <th key={h} scope="col" className="p-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((e) => (
                <tr className="border-t" key={e.id}>
                  <td className="p-3 whitespace-nowrap">
                    <time dateTime={e.at}>
                      {new Date(e.at).toLocaleString()}
                    </time>
                  </td>
                  <td className="p-3">{e.actor}</td>
                  <td className="p-3">{e.action}</td>
                  <td className="max-w-64 p-3 break-words">{e.subjectId}</td>
                  <td className="p-3">{e.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border p-6">
          <p>No audit entries match these filters.</p>
          {db.audit.length ? (
            <Button
              className="mt-3"
              variant="outline"
              onClick={() => {
                setAction("")
                setFrom("")
                setTo("")
                setText("")
              }}
            >
              Clear filters
            </Button>
          ) : (
            <Link to="/data" className="mt-3 inline-block underline">
              Load fictional sample data
            </Link>
          )}
        </div>
      )}
    </>
  )
}
