import * as C from "@/domain/calc"
import * as O from "@/domain/options"
import type { Patient } from "@/domain/schema"
import { patientFieldLabels } from "./patient-fields"
import { DerivedValue } from "@/components/form"

const display = (value: number | null | undefined) =>
  value == null ? null : C.round(value)
export function PatientDerived({ patient: p }: { patient: Patient }) {
  const phm = C.patientPhm(p)
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
          hint="Reed 2014; extrapolated for children"
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
const vocab: Record<string, ReadonlyArray<O.Option>> = {
  sex: O.SEX,
  ethnicity: O.ETHNICITY,
  state: O.CANDIDATE_STATE,
  urgencyStatus: O.URGENCY_STATUS,
  abo: O.ABO,
  subtype: O.ABO_SUBTYPE,
  primary: O.HEART_DIAGNOSIS,
  device: O.MCS_DEVICE,
  nyha: O.NYHA,
  dialysis: O.DIALYSIS,
  diabetes: O.DIABETES,
  smoking: O.SMOKING,
  transfusions: O.TRANSFUSION_BAND,
  agent: O.INOTROPE_AGENT,
}
function readable(key: string, value: unknown): string {
  if (value === null || value === "") return "Not recorded"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (typeof value === "string")
    return O.labelOf(vocab[key] ?? [...O.TRI, ...O.SEROLOGY], value)
  if (Array.isArray(value))
    return value.length
      ? value
          .map((v) =>
            typeof v === "object"
              ? Object.entries(v)
                  .filter(([k]) => k !== "id")
                  .map(([k, x]) => `${k}: ${readable(k, x)}`)
                  .join("; ")
              : String(v)
          )
          .join("; ")
      : "None recorded"
  return String(value)
}
export function PatientSummary({ patient }: { patient: Patient }) {
  return (
    <div className="space-y-5">
      {Object.entries(patient)
        .filter(([key]) => !["id", "createdAt", "updatedAt"].includes(key))
        .map(([section, value]) => (
          <section key={section} className="border bg-card p-4">
            <h2 className="mb-3 text-lg font-semibold capitalize">
              {section.replace(/([A-Z])/g, " $1")}
            </h2>
            {typeof value === "object" ? (
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(value).map(([key, item]) => (
                  <div key={key}>
                    <dt className="text-xs text-muted-foreground">
                      {patientFieldLabels[`${section}.${key}`]?.label ??
                        key.replace(/([A-Z])/g, " $1")}
                    </dt>
                    <dd className="text-sm break-words">
                      {readable(key, item)}
                      {item !== null &&
                      patientFieldLabels[`${section}.${key}`]?.unit
                        ? ` ${patientFieldLabels[`${section}.${key}`]?.unit}`
                        : ""}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p>{readable(section, value)}</p>
            )}
            {section === "body" && <PatientDerived patient={patient} />}
            {section === "hemodynamics" && (
              <PatientHemodynamics patient={patient} />
            )}
          </section>
        ))}
    </div>
  )
}
