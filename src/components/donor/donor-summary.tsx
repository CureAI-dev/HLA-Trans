import type { Donor } from "@/domain/schema"
import { bmi, bsaMosteller, donorPhm, round } from "@/domain/calc"
import { DerivedValue } from "@/components/form"

export function DonorDerived({ donor: d }: { donor: Donor }) {
  const mass = donorPhm(d)
  const bodyBmi = bmi(d.body.heightCm, d.body.weightKg)
  const bsa = bsaMosteller(d.body.heightCm, d.body.weightKg)
  return (
    <div className="my-4 grid gap-4 sm:grid-cols-3">
      <DerivedValue
        label="BMI"
        value={bodyBmi === null ? null : round(bodyBmi)}
        unit="kg/m²"
      />
      <DerivedValue
        label="BSA (Mosteller)"
        value={bsa === null ? null : round(bsa)}
        unit="m²"
      />
      <DerivedValue
        label="Predicted heart mass"
        value={mass === null ? null : round(mass.total)}
        unit="g"
      />
    </div>
  )
}
export function DonorSummary({ donor: d }: { donor: Donor }) {
  return (
    <section className="space-y-4 border p-4">
      <h2 className="text-lg font-semibold">Donor summary</h2>
      <dl className="grid gap-4 sm:grid-cols-3">
        {Object.entries({
          "Donor ID": d.identity.donorId,
          State: d.identity.state,
          Hospital: d.identity.donorHospital,
          OPO: d.identity.opo,
          "Age (years)": d.identity.ageYears,
          ABO: d.blood.abo,
          Donation: d.donation.type,
          "Weight (kg)": d.body.weightKg,
          "Height (cm)": d.body.heightCm,
          "LVEF (%)": d.echo.repeatLvef ?? d.echo.lvef,
          "Latest sodium (mmol/L)": d.labs.sodiumLatest,
          "PHS risk criteria": d.history.phsRiskCriteria.length,
        }).map(([key, value]) => (
          <div key={key}>
            <dt className="text-sm text-muted-foreground">{key}</dt>
            <dd className="font-medium">
              {value === null || value === "" ? "Not recorded" : value}
            </dd>
          </div>
        ))}
      </dl>
      <DonorDerived donor={d} />
      <p className="whitespace-pre-wrap">
        {d.notes || "No clinical notes recorded."}
      </p>
      <p className="text-sm text-muted-foreground">
        Use Edit donor to review the complete clinical record.
      </p>
    </section>
  )
}
