import * as C from "@/domain/calc"
import type { Patient } from "@/domain/schema"
import { DerivedValue } from "@/components/form"

const display = (value: number | null | undefined) =>
  value == null ? null : C.round(value)
export function PatientDerived({ patient: p }: { patient: Patient }) {
  const phm = C.patientPhm(p)
  const age = C.patientAge(p)
  const phmHint =
    age !== null && age < 18
      ? "Reed 2014; extrapolated for children"
      : "Reed 2014"
  const value = C.bmi(p.body.heightCm, p.body.weightKg)
  return (
    <div className="col-span-full grid gap-3 sm:grid-cols-3">
      <DerivedValue
        label="BMI"
        value={display(value)}
        unit="kg/m^2"
        hint={C.bmiCategory(value) ?? undefined}
      />
      <DerivedValue
        label="BSA (Mosteller)"
        value={display(C.bsaMosteller(p.body.heightCm, p.body.weightKg))}
        unit="m^2"
      />
      <DerivedValue
        label="BSA (DuBois)"
        value={display(C.bsaDuBois(p.body.heightCm, p.body.weightKg))}
        unit="m^2"
      />
      {(["lv", "rv", "total"] as const).map((key) => (
        <DerivedValue
          key={key}
          label={`Predicted heart mass (${key.toUpperCase()})`}
          value={display(phm?.[key])}
          unit="g"
          hint={phmHint}
        />
      ))}
    </div>
  )
}
export function PatientHemodynamics({ patient }: { patient: Patient }) {
  const h = C.patientHemodynamics(patient)
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
      />
      <DerivedValue
        label={
          h.cardiacIndexDerived
            ? "Cardiac index (derived CO/BSA)"
            : "Cardiac index (measured)"
        }
        value={display(h.cardiacIndex)}
        unit="L/min/m^2"
      />
      <DerivedValue label="TPG" value={display(h.tpg)} unit="mmHg" />
      <DerivedValue label="DPG" value={display(h.dpg)} unit="mmHg" />
      <DerivedValue label="PVR" value={display(h.pvr)} unit="WU" />
      <DerivedValue label="PVRI" value={display(h.pvri)} unit="WU*m^2" />
    </div>
  )
}
