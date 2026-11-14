import { estimateIschemia } from "@/domain/calc"
import type { PairInputs, Patient, Criteria } from "@/domain/schema"

export function IschemiaBreakdown({
  pair,
  patient,
  criteria,
}: {
  pair: PairInputs
  patient: Patient
  criteria: Criteria
}) {
  const estimate = estimateIschemia(pair, patient, criteria.logistics)
  return (
    <section className="border p-4">
      <h2 className="text-lg font-semibold">Ischemia breakdown</h2>
      {estimate ? (
        <>
          <dl className="my-3 grid grid-cols-2 gap-2">
            {estimate.parts.map((part) => (
              <div key={part.label}>
                <dt>{part.label}</dt>
                <dd>{part.minutes} minutes</dd>
              </div>
            ))}
            <div>
              <dt>Normothermic perfusion entered</dt>
              <dd>
                {pair.perfusionMinutes ?? "Not recorded"} minutes (subtracted
                only for OCS, capped at total)
              </dd>
            </div>
            <div>
              <dt>Total estimated time</dt>
              <dd>{estimate.totalMinutes} minutes</dd>
            </div>
            <div>
              <dt>Cold ischemic time</dt>
              <dd>{estimate.coldMinutes} minutes</dd>
            </div>
          </dl>
          {estimate.unknowns.map((text) => (
            <p key={text}>REVIEW / Missing data: {text}</p>
          ))}
        </>
      ) : (
        <p>
          REVIEW / Missing data: complete procurement, transport and implant
          times; OCS also needs perfusion time.
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        Redo and device explant additions use the criteria shown with this
        evaluation.
      </p>
    </section>
  )
}
