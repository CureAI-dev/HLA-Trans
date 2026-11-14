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
          {saved ? "Frozen evaluation result" : "Live evaluation preview"}
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
            {missing.map(({ finding, rule }) => (
              <li key={finding.code}>
                <a className="underline" href={`#rule-${rule}`}>
                  {finding.title}
                </a>{" "}
                /{" "}
                <a
                  className="underline"
                  href={
                    rule === "logistics"
                      ? saved
                        ? `/evaluations/new?patientId=${encodeURIComponent(patient.id)}&donorId=${encodeURIComponent(donor.id)}#pair-inputs`
                        : "#pair-inputs"
                      : rule === "donorHeart"
                        ? `/donors/${encodeURIComponent(donor.id)}/edit`
                        : `/patients/${encodeURIComponent(patient.id)}/edit`
                  }
                >
                  Review inputs
                </a>
                {rule !== "logistics" && (
                  <span>
                    {" "}
                    /{" "}
                    <a
                      className="underline"
                      href={`/donors/${encodeURIComponent(donor.id)}/edit`}
                    >
                      Donor record
                    </a>{" "}
                    /{" "}
                    <a
                      className="underline"
                      href={`/patients/${encodeURIComponent(patient.id)}/edit`}
                    >
                      Patient record
                    </a>
                  </span>
                )}
              </li>
            ))}
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
