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
