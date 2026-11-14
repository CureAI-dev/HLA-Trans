import { CRITERIA_FIELDS, OUTCOME_LABEL } from "@/domain/criteria"
import type { Criteria } from "@/domain/schema"

export function criteriaChanges(before: Criteria, after: Criteria) {
  return CRITERIA_FIELDS.flatMap((field) => {
    const oldValue = (before[field.section] as Record<string, unknown>)[
      field.key
    ]
    const newValue = (after[field.section] as Record<string, unknown>)[
      field.key
    ]
    return oldValue === newValue ? [] : [{ field, oldValue, newValue }]
  })
}
function display(value: unknown) {
  if (value === null) return "No limit"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (value === "pass" || value === "review" || value === "fail")
    return OUTCOME_LABEL[value]
  return String(value)
}
export function CriteriaDiff({
  before,
  after,
}: {
  before: Criteria
  after: Criteria
}) {
  const changes = criteriaChanges(before, after)
  if (!changes.length) return <p>No field changes.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Criteria field changes</caption>
        <thead>
          <tr>
            <th className="p-2">Field</th>
            <th className="p-2">Previous</th>
            <th className="p-2">New</th>
          </tr>
        </thead>
        <tbody>
          {changes.map(({ field, oldValue, newValue }) => (
            <tr className="border-t" key={`${field.section}.${field.key}`}>
              <th className="p-2 font-normal">
                {field.label}
                {field.kind === "number" && field.unit
                  ? ` (${field.unit})`
                  : ""}
              </th>
              <td className="p-2">{display(oldValue)}</td>
              <td className="p-2">{display(newValue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
