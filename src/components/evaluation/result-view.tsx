import { Link } from "@tanstack/react-router"
import type { LinkOptions } from "@tanstack/react-router"
import type {
  EvaluationResult,
  Patient,
  Donor,
  PairInputs,
  Criteria,
} from "@/domain/schema"
import { StatusBadge, VerdictStrip } from "@/components/app/status"
import { RuleCard, FindingView } from "./rule-card"
import { SideBySide } from "./side-by-side"
import { IschemiaBreakdown } from "./ischemia-breakdown"
import { CROSSMATCH, PRESERVATION } from "@/domain/options"

function reviewLink(
  rule: string,
  saved: boolean,
  patientId: string,
  donorId: string
): LinkOptions | null {
  if (rule === "logistics")
    return saved
      ? {
          to: "/matches/check",
          search: { patientId, donorId },
          hash: "pair-inputs",
        }
      : null // live preview: the pair inputs are on this page
  if (rule === "donorHeart")
    return { to: "/donors/$donorId/edit", params: { donorId } }
  return { to: "/patients/$patientId/edit", params: { patientId } }
}

export function ResultView({
  result,
  patient,
  donor,
  pair,
  criteria,
  criteriaVersion,
  saved = false,
}: {
  result: EvaluationResult
  patient: Patient
  donor: Donor
  pair: PairInputs
  criteria: Criteria
  criteriaVersion: number
  saved?: boolean
}) {
  const missing = result.rules.flatMap((r) =>
    r.findings
      .filter((f) => f.missing)
      .map((f) => ({ finding: f, rule: r.rule }))
  )
  return (
    <div
      className="space-y-5"
      onClick={(event) => {
        if (!(event.target instanceof Element)) return
        const href = event.target.closest("a")?.getAttribute("href")
        if (!href?.startsWith("#rule-")) return
        const target = document.getElementById(href.slice(1))
        if (target instanceof HTMLDetailsElement) target.open = true
      }}
    >
      <section
        aria-label="Compatibility result"
        className="space-y-3 border p-4"
      >
        <h2 className="text-xl font-semibold">
          {saved ? "Saved match result" : "Live preview"}
        </h2>
        <StatusBadge status={result.overall} />
        <p>
          Criteria version {criteriaVersion} / Engine {result.engineVersion}
        </p>
        <p>The app advises; the clinician makes the final decision.</p>
      </section>
      <VerdictStrip rules={result.rules} />
      {result.blockers.length > 0 && (
        <section className="border p-4">
          <h2>Blockers</h2>
          <ul>
            {result.blockers.map((f) => (
              <FindingView key={f.code} finding={f} />
            ))}
          </ul>
        </section>
      )}
      {missing.length > 0 && (
        <section className="border p-4">
          <h2 className="font-semibold">Missing data ({missing.length})</h2>
          <ul className="list-inside list-disc">
            {missing.map(({ finding, rule }) => {
              const link = reviewLink(rule, saved, patient.id, donor.id)
              return (
                <li key={finding.code}>
                  <a className="underline" href={`#rule-${rule}`}>
                    {finding.title}
                  </a>{" "}
                  /{" "}
                  {link ? (
                    <Link {...link} className="underline">
                      Review inputs
                    </Link>
                  ) : (
                    <a className="underline" href="#pair-inputs">
                      Review inputs
                    </a>
                  )}
                  {rule !== "logistics" && (
                    <span>
                      {" "}
                      /{" "}
                      <Link
                        className="underline"
                        to="/donors/$donorId/edit"
                        params={{ donorId: donor.id }}
                      >
                        Donor record
                      </Link>{" "}
                      /{" "}
                      <Link
                        className="underline"
                        to="/patients/$patientId/edit"
                        params={{ patientId: patient.id }}
                      >
                        Patient record
                      </Link>
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}
      <SideBySide patient={patient} donor={donor} />
      {saved && (
        <section className="border p-4">
          <h2 className="text-lg font-semibold">Frozen pair inputs</h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            {[
              ["Distance (NM)", pair.distanceNm],
              ["Procurement (minutes)", pair.procurementMinutes],
              ["Transport (minutes)", pair.transportMinutes],
              ["Implant (minutes)", pair.implantMinutes],
              ["Perfusion (minutes)", pair.perfusionMinutes],
              [
                "Preservation",
                PRESERVATION.find((o) => o.value === pair.preservation)?.label,
              ],
              [
                "Flow crossmatch",
                CROSSMATCH.find((o) => o.value === pair.flowCrossmatch)?.label,
              ],
              [
                "CDC crossmatch",
                CROSSMATCH.find((o) => o.value === pair.cdcCrossmatch)?.label,
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value ?? "Not recorded"}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      <IschemiaBreakdown pair={pair} patient={patient} criteria={criteria} />
      {result.rules.map((rule) => (
        <RuleCard key={rule.rule} rule={rule} />
      ))}
    </div>
  )
}
