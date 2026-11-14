import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useDb } from "@/lib/storage/db"
import { PageHeader } from "@/components/app/page-header"
import { StatusBadge } from "@/components/app/status"
import { DateField, SelectField } from "@/components/form"
import { localCalendarDate } from "@/domain/dates"

export const Route = createFileRoute("/evaluations/")({ component: History })
function History() {
  const db = useDb()
  const [verdict, setVerdict] = useState("all"),
    [decision, setDecision] = useState("all"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("")
  const rows = db.evaluations
    .filter(
      (e) =>
        (verdict === "all" || e.result.overall === verdict) &&
        (decision === "all" ||
          (decision === "pending" ? !e.decision : !!e.decision)) &&
        (!from || localCalendarDate(e.createdAt) >= from) &&
        (!to || localCalendarDate(e.createdAt) <= to)
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return (
    <div className="space-y-5">
      <PageHeader
        title="Evaluation history"
        description="Frozen compatibility assessments and final clinician decisions."
        actions={
          <a href="/evaluations/new" className="border px-3 py-2">
            New evaluation
          </a>
        }
      />
      <div className="grid gap-4 md:grid-cols-4">
        <SelectField
          label="Overall verdict"
          value={verdict}
          onChange={setVerdict}
          options={[
            { value: "all", label: "All verdicts" },
            { value: "pass", label: "PASS" },
            { value: "review", label: "REVIEW" },
            { value: "fail", label: "FAIL" },
          ]}
        />
        <SelectField
          label="Decision status"
          value={decision}
          onChange={setDecision}
          options={[
            { value: "all", label: "All decisions" },
            { value: "pending", label: "Pending" },
            { value: "decided", label: "Decided" },
          ]}
        />
        <DateField label="Saved from" value={from} onChange={setFrom} />
        <DateField label="Saved through" value={to} onChange={setTo} />
      </div>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th>Saved</th>
                <th>Patient</th>
                <th>Donor</th>
                <th>Result</th>
                <th>Decision</th>
                <th>Criteria</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr className="border-t" key={e.id}>
                  <td className="p-3">
                    <a className="underline" href={`/evaluations/${e.id}`}>
                      {new Date(e.createdAt).toLocaleString()}
                    </a>
                  </td>
                  <td>
                    {e.patientSnapshot.identity.firstName}{" "}
                    {e.patientSnapshot.identity.lastName}
                  </td>
                  <td>{e.donorSnapshot.identity.donorId}</td>
                  <td>
                    <StatusBadge status={e.result.overall} />
                  </td>
                  <td>{e.decision?.verdict ?? "Pending"}</td>
                  <td>v{e.criteriaVersion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>
          No evaluations match these filters.{" "}
          <a className="underline" href="/evaluations/new">
            Create an evaluation
          </a>
          .
        </p>
      )}
    </div>
  )
}
