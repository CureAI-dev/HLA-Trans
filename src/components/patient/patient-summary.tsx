import * as C from "@/domain/calc"
import { SEX } from "@/domain/options"
import type { Patient } from "@/domain/schema"
import { DerivedValue } from "@/components/form"
import { DERIVED_COPY, shown } from "@/components/form/derived-help"
import type { HelpInput } from "@/components/form/derived-help"

const display = (value: number | null | undefined) =>
  value == null ? null : C.round(value)

type SummaryProps = {
  patient: Patient
  /** In the form, help popovers link each input to its field. */
  linkFields?: boolean
}

function bodyInputs(p: Patient): HelpInput[] {
  return [
    {
      label: "Height",
      field: "field-body.heightCm",
      value: shown(p.body.heightCm, "cm"),
    },
    {
      label: "Weight",
      field: "field-body.weightKg",
      value: shown(p.body.weightKg, "kg"),
    },
  ]
}

export function PatientDerived({ patient: p, linkFields }: SummaryProps) {
  const phm = C.patientPhm(p)
  const age = C.patientAge(p)
  const phmHint =
    age !== null && age < 18
      ? "Reed 2014; extrapolated for children"
      : "Reed 2014"
  const value = C.bmi(p.body.heightCm, p.body.weightKg)
  const body = bodyInputs(p)
  const sex: HelpInput = {
    label: "Sex",
    field: "field-identity.sex",
    value: SEX.find((s) => s.value === p.identity.sex)?.label ?? null,
  }
  const dob: HelpInput = {
    label: "Date of birth",
    field: "field-identity.dateOfBirth",
    value: shown(p.identity.dateOfBirth),
  }
  const phmInputs = {
    lv: [sex, ...body],
    rv: [sex, dob, ...body],
    total: [sex, dob, ...body],
  }
  const phmCopy = {
    lv: DERIVED_COPY.phmLv,
    rv: DERIVED_COPY.phmRv,
    total: DERIVED_COPY.phmTotal,
  }
  return (
    <div className="col-span-full grid gap-3 sm:grid-cols-3">
      <DerivedValue
        label="BMI"
        value={display(value)}
        unit="kg/m^2"
        hint={C.bmiCategory(value) ?? undefined}
        help={{ ...DERIVED_COPY.bmi, inputs: body }}
        linkFields={linkFields}
      />
      <DerivedValue
        label="BSA (Mosteller)"
        value={display(C.bsaMosteller(p.body.heightCm, p.body.weightKg))}
        unit="m^2"
        help={{ ...DERIVED_COPY.bsaMosteller, inputs: body }}
        linkFields={linkFields}
      />
      <DerivedValue
        label="BSA (DuBois)"
        value={display(C.bsaDuBois(p.body.heightCm, p.body.weightKg))}
        unit="m^2"
        help={{ ...DERIVED_COPY.bsaDuBois, inputs: body }}
        linkFields={linkFields}
      />
      {(["lv", "rv", "total"] as const).map((key) => (
        <DerivedValue
          key={key}
          label={`Predicted heart mass (${key.toUpperCase()})`}
          value={display(phm?.[key])}
          unit="g"
          hint={phmHint}
          help={{ ...phmCopy[key], inputs: phmInputs[key] }}
          linkFields={linkFields}
        />
      ))}
    </div>
  )
}

export function PatientHemodynamics({ patient, linkFields }: SummaryProps) {
  const h = C.patientHemodynamics(patient)
  const r = patient.hemodynamics
  const input = (
    label: string,
    key: keyof Patient["hemodynamics"],
    unit: string
  ): HelpInput => {
    const v = r[key]
    return {
      label,
      field: `field-hemodynamics.${key}`,
      value: typeof v === "number" ? shown(v, unit) : null,
    }
  }
  const paMean = input("PA mean", "paMean", "mmHg")
  const paSys = input("PA systolic", "paSystolic", "mmHg")
  const paDia = input("PA diastolic", "paDiastolic", "mmHg")
  const pcwp = input("PCWP", "pcwp", "mmHg")
  const co = input("Cardiac output", "cardiacOutput", "L/min")
  const ci = input("Cardiac index", "cardiacIndex", "L/min/m^2")
  const body = bodyInputs(patient)
  const pressures = [paMean, paSys, paDia]
  return (
    <div className="col-span-full grid gap-3 sm:grid-cols-3">
      <DerivedValue
        label={
          h.paMeanDerived
            ? "Mean PA pressure (estimated)"
            : "Mean PA pressure (measured)"
        }
        value={display(h.paMean)}
        unit="mmHg"
        help={{ ...DERIVED_COPY.paMean, inputs: pressures }}
        linkFields={linkFields}
      />
      <DerivedValue
        label={
          h.cardiacIndexDerived
            ? "Cardiac index (derived CO/BSA)"
            : "Cardiac index (measured)"
        }
        value={display(h.cardiacIndex)}
        unit="L/min/m^2"
        help={{ ...DERIVED_COPY.cardiacIndex, inputs: [ci, co, ...body] }}
        linkFields={linkFields}
      />
      <DerivedValue
        label="TPG"
        value={display(h.tpg)}
        unit="mmHg"
        help={{ ...DERIVED_COPY.tpg, inputs: [...pressures, pcwp] }}
        linkFields={linkFields}
      />
      <DerivedValue
        label="DPG"
        value={display(h.dpg)}
        unit="mmHg"
        help={{ ...DERIVED_COPY.dpg, inputs: [paDia, pcwp] }}
        linkFields={linkFields}
      />
      <DerivedValue
        label="PVR"
        value={display(h.pvr)}
        unit="WU"
        help={{ ...DERIVED_COPY.pvr, inputs: [...pressures, pcwp, co] }}
        linkFields={linkFields}
      />
      <DerivedValue
        label="PVRI"
        value={display(h.pvri)}
        unit="WU*m^2"
        help={{
          ...DERIVED_COPY.pvri,
          inputs: [...pressures, pcwp, ci, co, ...body],
        }}
        linkFields={linkFields}
      />
    </div>
  )
}
