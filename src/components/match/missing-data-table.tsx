import { Link } from "@tanstack/react-router"
import type { Finding, RuleId } from "@/domain/schema"
import { missingFieldTarget } from "@/domain/missing-fields"
import { RULE_TITLES } from "./rule-card"

// Kept local (not imported from the forms) so the result page does not pull in
// the form bundles. Ids match patientSections / donorSections.
const SECTION_TITLES: Record<string, string> = {
  identity: "Identity",
  listing: "Listing",
  body: "Body",
  blood: "Blood type",
  diagnosis: "Diagnosis",
  hemodynamics: "Hemodynamics",
  support: "Support",
  function: "Function",
  labs: "Labs",
  history: "History",
  sensitization: "Sensitization",
  acceptance: "Acceptance",
  hla: "HLA typing",
  serology: "Serology",
  donation: "Donation",
  death: "Death",
  echo: "Echocardiography",
  coronary: "Coronary",
  ecg: "Electrocardiogram",
  infection: "Infection and serology",
  "pair-inputs": "Pair inputs",
}

export type MissingItem = { rule: RuleId; finding: Finding }

export function MissingDataTable({
  items,
  patientId,
  donorId,
  onPairFix,
}: {
  items: MissingItem[]
  patientId: string
  donorId: string
  onPairFix: () => void
}) {
  if (!items.length) return null
  return (
    <section aria-labelledby="missing-data" className="border bg-card">
      <h2
        id="missing-data"
        className="border-b bg-muted px-4 py-2 text-sm font-semibold"
      >
        Missing data ({items.length}): these findings stay REVIEW until
        recorded
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2 font-medium">
                Field
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                Rule
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                Fix
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map(({ rule, finding }) => {
              const t = missingFieldTarget(rule, finding.code)
              const section = SECTION_TITLES[t.section] ?? t.section
              return (
                <tr key={`${rule}:${finding.code}`} className="border-t">
                  <td className="px-4 py-2">{finding.title}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {RULE_TITLES[rule]}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {t.entity === "pair" ? (
                      <button
                        type="button"
                        className="underline underline-offset-4"
                        onClick={onPairFix}
                      >
                        Enter pair inputs
                      </button>
                    ) : t.entity === "patient" ? (
                      <Link
                        to="/patients/$patientId/edit"
                        params={{ patientId }}
                        hash={t.section}
                        className="underline underline-offset-4"
                      >
                        Edit patient · {section}
                      </Link>
                    ) : (
                      <Link
                        to="/donors/$donorId/edit"
                        params={{ donorId }}
                        hash={t.section}
                        className="underline underline-offset-4"
                      >
                        Edit donor · {section}
                      </Link>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
