import type { Donor } from "@/domain/schema"
import { bmi, bsaMosteller, donorPhm, round } from "@/domain/calc"
import { SEX } from "@/domain/options"
import { DerivedValue } from "@/components/form"
import { DERIVED_COPY, shown } from "@/components/form/derived-help"
import type { HelpInput } from "@/components/form/derived-help"

export function DonorDerived({
  donor: d,
  linkFields,
}: {
  donor: Donor
  /** In the form, help popovers link each input to its field. */
  linkFields?: boolean
}) {
  const mass = donorPhm(d)
  const bodyBmi = bmi(d.body.heightCm, d.body.weightKg)
  const bsa = bsaMosteller(d.body.heightCm, d.body.weightKg)
  const body: HelpInput[] = [
    {
      label: "Height",
      field: "field-body.heightCm",
      value: shown(d.body.heightCm, "cm"),
    },
    {
      label: "Weight",
      field: "field-body.weightKg",
      value: shown(d.body.weightKg, "kg"),
    },
  ]
  const phmInputs: HelpInput[] = [
    {
      label: "Sex",
      field: "field-identity.sex",
      value: SEX.find((s) => s.value === d.identity.sex)?.label ?? null,
    },
    {
      label: "Age",
      field: "field-identity.ageYears",
      value: shown(d.identity.ageYears, "years"),
    },
    ...body,
  ]
  const parts = mass
    ? ` Here: LV ${round(mass.lv)} g + RV ${round(mass.rv)} g.`
    : ""
  return (
    <div className="my-4 grid gap-4 sm:grid-cols-3">
      <DerivedValue
        label="BMI"
        value={bodyBmi === null ? null : round(bodyBmi)}
        unit="kg/m²"
        help={{ ...DERIVED_COPY.bmi, inputs: body }}
        linkFields={linkFields}
      />
      <DerivedValue
        label="BSA (Mosteller)"
        value={bsa === null ? null : round(bsa)}
        unit="m²"
        help={{
          ...DERIVED_COPY.bsaMosteller,
          usedFor: "Display only. Donor size is matched by PHM or weight.",
          inputs: body,
        }}
        linkFields={linkFields}
      />
      <DerivedValue
        label="Predicted heart mass"
        value={mass === null ? null : round(mass.total)}
        unit="g"
        help={{
          formula: `LV + RV (Reed 2014). LV = a × H^0.54 × W^0.61; RV = b × age^−0.32 × H^1.135 × W^0.315.${parts}`,
          usedFor: DERIVED_COPY.phmTotal.usedFor,
          inputs: phmInputs,
        }}
        linkFields={linkFields}
      />
    </div>
  )
}
