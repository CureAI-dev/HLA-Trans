import { useState } from "react"
import { flushSync } from "react-dom"
import { useNavigate } from "@tanstack/react-router"
import * as O from "@/domain/options"
import { donorSchema, type Donor } from "@/domain/schema"
import { actions } from "@/lib/storage/db"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import {
  TextField,
  NumberField,
  DateField,
  SelectField,
  TriField,
  SwitchField,
  FormSection,
  FormSideNav,
  HlaTypingGrid,
  VasoactiveList,
  SerologyGrid,
  useFormState,
} from "@/components/form"
import { DonorDerived } from "./donor-summary"

export const donorSections = [
  { id: "identity", title: "Identity" },
  { id: "body", title: "Body measurements" },
  { id: "blood", title: "Blood type" },
  { id: "donation", title: "Donation" },
  { id: "death", title: "Death" },
  { id: "history", title: "History" },
  { id: "hemodynamics", title: "Hemodynamics and support" },
  { id: "echo", title: "Echocardiography" },
  { id: "coronary", title: "Coronary" },
  { id: "ecg", title: "Electrocardiogram" },
  { id: "labs", title: "Labs" },
  { id: "infection", title: "Infection and serology" },
  { id: "hla", title: "HLA typing" },
  { id: "notes", title: "Notes" },
]
export function DonorForm({ initial }: { initial: Donor }) {
  const form = useFormState(initial, donorSchema)
  const p = form.value
  const navigate = useNavigate()
  const [saveError, setSaveError] = useState("")
  const subErrors = (prefix: string) =>
    Object.fromEntries(
      Object.entries(form.errors)
        .filter(([key]) => key.startsWith(prefix + "."))
        .map(([key, value]) => [key.slice(prefix.length + 1), value])
    )
  function save(event: React.FormEvent) {
    event.preventDefault()
    if (!form.validate()) {
      setSaveError("Please correct the marked fields before saving.")
      return
    }
    try {
      const saved = actions.saveDonor(p)
      flushSync(() => form.reset(saved))
      toast.add({ title: "Donor saved" })
      void navigate({ to: "/donors/$donorId", params: { donorId: saved.id } })
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Unable to save donor."
      )
    }
  }
  return (
    <form
      onSubmit={save}
      noValidate
      className="grid gap-6 lg:grid-cols-[190px_minmax(0,1fr)]"
    >
      <aside>
        <FormSideNav sections={donorSections} />
      </aside>
      <div className="space-y-6">
        {saveError && (
          <p role="alert" className="border p-3">
            {saveError}
          </p>
        )}
        <FormSection id="identity" title="Identity">
          <div className="grid gap-4 md:grid-cols-2">
            <TextField
              label="Donor ID *"
              value={p.identity.donorId}
              onChange={(value) => form.set("identity.donorId", value)}
              error={form.errors["identity.donorId"]}
            />
            <SelectField
              label="State"
              value={p.identity.state}
              onChange={(value) => form.set("identity.state", value)}
              error={form.errors["identity.state"]}
              options={O.DONOR_STATE}
            />
            <TextField
              label="Donor hospital"
              value={p.identity.donorHospital}
              onChange={(value) => form.set("identity.donorHospital", value)}
              error={form.errors["identity.donorHospital"]}
            />
            <TextField
              label="Organ procurement organization (OPO)"
              value={p.identity.opo}
              onChange={(value) => form.set("identity.opo", value)}
              error={form.errors["identity.opo"]}
            />
            <DateField
              label="Referral date"
              value={p.identity.referralDate}
              onChange={(value) => form.set("identity.referralDate", value)}
              error={form.errors["identity.referralDate"]}
            />
            <NumberField
              label="Age"
              value={p.identity.ageYears}
              onChange={(value) => form.set("identity.ageYears", value)}
              error={form.errors["identity.ageYears"]}
              unit="years"
            />
            <SelectField
              label="Sex"
              value={p.identity.sex}
              onChange={(value) => form.set("identity.sex", value)}
              error={form.errors["identity.sex"]}
              options={O.SEX}
            />
            <SelectField
              label="Ethnicity"
              value={p.identity.ethnicity}
              onChange={(value) => form.set("identity.ethnicity", value)}
              error={form.errors["identity.ethnicity"]}
              options={O.ETHNICITY}
            />
          </div>
        </FormSection>
        <FormSection id="body" title="Body measurements">
          <div className="grid gap-4 md:grid-cols-2">
            <NumberField
              label="Height"
              value={p.body.heightCm}
              onChange={(value) => form.set("body.heightCm", value)}
              error={form.errors["body.heightCm"]}
              unit="cm"
            />
            <NumberField
              label="Weight"
              value={p.body.weightKg}
              onChange={(value) => form.set("body.weightKg", value)}
              error={form.errors["body.weightKg"]}
              unit="kg"
            />
          </div>
          <DonorDerived donor={p} />
        </FormSection>
        <FormSection id="blood" title="Blood type">
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              label="ABO blood type"
              value={p.blood.abo ?? ""}
              onChange={(value) =>
                form.set("blood.abo", value === "" ? null : value)
              }
              options={[{ value: "", label: "Not recorded" }, ...O.ABO]}
              error={form.errors["blood.abo"]}
            />
            <SelectField
              label="Subtype"
              value={p.blood.subtype}
              onChange={(value) => form.set("blood.subtype", value)}
              error={form.errors["blood.subtype"]}
              options={O.ABO_SUBTYPE}
            />
            <SwitchField
              label="ABO verified by two independent samples"
              value={p.blood.verifiedTwoSamples}
              onChange={(value) => form.set("blood.verifiedTwoSamples", value)}
              error={form.errors["blood.verifiedTwoSamples"]}
            />
          </div>
        </FormSection>
        <FormSection id="donation" title="Donation">
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              label="Donation type"
              value={p.donation.type}
              onChange={(value) => form.set("donation.type", value)}
              error={form.errors["donation.type"]}
              options={O.DONATION_TYPE}
            />
            <DateField
              label="Brain death date"
              value={p.donation.brainDeathDate}
              onChange={(value) => form.set("donation.brainDeathDate", value)}
              error={form.errors["donation.brainDeathDate"]}
            />
            <SelectField
              label="DCD recovery technique"
              value={p.donation.dcdRecovery ?? ""}
              onChange={(value) =>
                form.set("donation.dcdRecovery", value === "" ? null : value)
              }
              options={[
                { value: "", label: "Not recorded" },
                ...O.DCD_RECOVERY,
              ]}
              error={form.errors["donation.dcdRecovery"]}
            />
            <NumberField
              label="Agonal phase minutes"
              value={p.donation.agonalPhaseMinutes}
              onChange={(value) =>
                form.set("donation.agonalPhaseMinutes", value)
              }
              error={form.errors["donation.agonalPhaseMinutes"]}
              unit="min"
            />
            <NumberField
              label="Functional warm ischemia minutes"
              value={p.donation.functionalWarmIschemiaMinutes}
              onChange={(value) =>
                form.set("donation.functionalWarmIschemiaMinutes", value)
              }
              error={form.errors["donation.functionalWarmIschemiaMinutes"]}
              unit="min"
            />
            <NumberField
              label="No touch minutes"
              value={p.donation.noTouchMinutes}
              onChange={(value) => form.set("donation.noTouchMinutes", value)}
              error={form.errors["donation.noTouchMinutes"]}
              unit="min"
            />
          </div>
        </FormSection>
        <FormSection id="death" title="Death">
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              label="Cause"
              value={p.death.cause ?? ""}
              onChange={(value) =>
                form.set("death.cause", value === "" ? null : value)
              }
              options={[
                { value: "", label: "Not recorded" },
                ...O.CAUSE_OF_DEATH,
              ]}
              error={form.errors["death.cause"]}
            />
            <SelectField
              label="Mechanism"
              value={p.death.mechanism ?? ""}
              onChange={(value) =>
                form.set("death.mechanism", value === "" ? null : value)
              }
              options={[
                { value: "", label: "Not recorded" },
                ...O.MECHANISM_OF_DEATH,
              ]}
              error={form.errors["death.mechanism"]}
            />
            <SelectField
              label="Circumstance"
              value={p.death.circumstance ?? ""}
              onChange={(value) =>
                form.set("death.circumstance", value === "" ? null : value)
              }
              options={[
                { value: "", label: "Not recorded" },
                ...O.CIRCUMSTANCE_OF_DEATH,
              ]}
              error={form.errors["death.circumstance"]}
            />
            <SwitchField
              label="Carbon monoxide poisoning"
              value={p.death.carbonMonoxidePoisoning}
              onChange={(value) =>
                form.set("death.carbonMonoxidePoisoning", value)
              }
              error={form.errors["death.carbonMonoxidePoisoning"]}
            />
            <NumberField
              label="Carboxyhemoglobin (COHb)"
              value={p.death.carboxyhemoglobinPct}
              onChange={(value) =>
                form.set("death.carboxyhemoglobinPct", value)
              }
              error={form.errors["death.carboxyhemoglobinPct"]}
              unit="%"
            />
            <TriField
              label="Cardiac arrest"
              value={p.death.cardiacArrest}
              onChange={(value) => form.set("death.cardiacArrest", value)}
              error={form.errors["death.cardiacArrest"]}
            />
            <NumberField
              label="CPR duration"
              value={p.death.cprMinutes}
              onChange={(value) => form.set("death.cprMinutes", value)}
              error={form.errors["death.cprMinutes"]}
              unit="min"
            />
            <SwitchField
              label="Unexplained sudden death"
              value={p.death.unexplainedSuddenDeath}
              onChange={(value) =>
                form.set("death.unexplainedSuddenDeath", value)
              }
              error={form.errors["death.unexplainedSuddenDeath"]}
            />
          </div>
        </FormSection>
        <FormSection id="history" title="History">
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              label="Hypertension"
              value={p.history.hypertension}
              onChange={(value) => form.set("history.hypertension", value)}
              error={form.errors["history.hypertension"]}
              options={O.HISTORY_DURATION}
            />
            <SelectField
              label="Diabetes"
              value={p.history.diabetes}
              onChange={(value) => form.set("history.diabetes", value)}
              error={form.errors["history.diabetes"]}
              options={O.HISTORY_DURATION}
            />
            <SwitchField
              label="Insulin dependent"
              value={p.history.insulinDependent}
              onChange={(value) => form.set("history.insulinDependent", value)}
              error={form.errors["history.insulinDependent"]}
            />
            <TriField
              label="Smoking history >20 pack-years"
              value={p.history.cigarettesOver20PackYears}
              onChange={(value) =>
                form.set("history.cigarettesOver20PackYears", value)
              }
              error={form.errors["history.cigarettesOver20PackYears"]}
            />
            <TriField
              label="Cocaine"
              value={p.history.cocaine}
              onChange={(value) => form.set("history.cocaine", value)}
              error={form.errors["history.cocaine"]}
            />
            <TriField
              label="Amphetamines"
              value={p.history.amphetamines}
              onChange={(value) => form.set("history.amphetamines", value)}
              error={form.errors["history.amphetamines"]}
            />
            <TriField
              label="Intravenous drug use"
              value={p.history.ivDrugUse}
              onChange={(value) => form.set("history.ivDrugUse", value)}
              error={form.errors["history.ivDrugUse"]}
            />
            <TriField
              label="Heavy alcohol"
              value={p.history.heavyAlcohol}
              onChange={(value) => form.set("history.heavyAlcohol", value)}
              error={form.errors["history.heavyAlcohol"]}
            />
            <TriField
              label="Prior myocardial infarction"
              value={p.history.priorMi}
              onChange={(value) => form.set("history.priorMi", value)}
              error={form.errors["history.priorMi"]}
            />
            <TriField
              label="Known coronary artery disease"
              value={p.history.knownCad}
              onChange={(value) => form.set("history.knownCad", value)}
              error={form.errors["history.knownCad"]}
            />
            <TriField
              label="Prior cardiac surgery"
              value={p.history.priorCardiacSurgery}
              onChange={(value) =>
                form.set("history.priorCardiacSurgery", value)
              }
              error={form.errors["history.priorCardiacSurgery"]}
            />
            <SelectField
              label="Malignancy risk"
              value={p.history.malignancyRisk}
              onChange={(value) => form.set("history.malignancyRisk", value)}
              error={form.errors["history.malignancyRisk"]}
              options={O.MALIGNANCY_RISK}
            />
            <TextField
              label="Malignancy detail"
              value={p.history.malignancyDetail}
              onChange={(value) => form.set("history.malignancyDetail", value)}
              error={form.errors["history.malignancyDetail"]}
            />
            <SelectField
              label="Transfusions this admission"
              value={p.history.transfusionsThisAdmission}
              onChange={(value) =>
                form.set("history.transfusionsThisAdmission", value)
              }
              error={form.errors["history.transfusionsThisAdmission"]}
              options={O.TRANSFUSION_BAND}
            />
            <TriField
              label="Born in a Chagas-endemic country"
              value={p.history.bornInChagasEndemicCountry}
              onChange={(value) =>
                form.set("history.bornInChagasEndemicCountry", value)
              }
              error={form.errors["history.bornInChagasEndemicCountry"]}
            />
            <fieldset className="space-y-3 md:col-span-2">
              <legend className="font-semibold">
                PHS 2020 risk criteria (last 30 days)
              </legend>
              {O.PHS_RISK_CRITERIA.map((option) => (
                <label key={option.value} className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={p.history.phsRiskCriteria.includes(option.value)}
                    onChange={(event) =>
                      form.set(
                        "history.phsRiskCriteria",
                        event.target.checked
                          ? [...p.history.phsRiskCriteria, option.value]
                          : p.history.phsRiskCriteria.filter(
                              (item) => item !== option.value
                            )
                      )
                    }
                  />
                  {option.label}
                </label>
              ))}
            </fieldset>
          </div>
        </FormSection>
        <FormSection id="hemodynamics" title="Hemodynamics and support">
          <div className="grid gap-4 md:grid-cols-2">
            <NumberField
              label="Heart rate"
              value={p.hemodynamics.heartRate}
              onChange={(value) => form.set("hemodynamics.heartRate", value)}
              error={form.errors["hemodynamics.heartRate"]}
              unit="beats/min"
            />
            <NumberField
              label="Systolic blood pressure"
              value={p.hemodynamics.systolicBp}
              onChange={(value) => form.set("hemodynamics.systolicBp", value)}
              error={form.errors["hemodynamics.systolicBp"]}
              unit="mmHg"
            />
            <NumberField
              label="Mean arterial pressure"
              value={p.hemodynamics.meanArterialPressure}
              onChange={(value) =>
                form.set("hemodynamics.meanArterialPressure", value)
              }
              error={form.errors["hemodynamics.meanArterialPressure"]}
              unit="mmHg"
            />
            <NumberField
              label="Central venous pressure"
              value={p.hemodynamics.cvp}
              onChange={(value) => form.set("hemodynamics.cvp", value)}
              error={form.errors["hemodynamics.cvp"]}
              unit="mmHg"
            />
            <NumberField
              label="Pulmonary capillary wedge pressure"
              value={p.hemodynamics.pcwp}
              onChange={(value) => form.set("hemodynamics.pcwp", value)}
              error={form.errors["hemodynamics.pcwp"]}
              unit="mmHg"
            />
            <NumberField
              label="Cardiac index"
              value={p.hemodynamics.cardiacIndex}
              onChange={(value) => form.set("hemodynamics.cardiacIndex", value)}
              error={form.errors["hemodynamics.cardiacIndex"]}
              unit="L/min/m²"
            />
            <NumberField
              label="Cardiac output"
              value={p.hemodynamics.cardiacOutput}
              onChange={(value) =>
                form.set("hemodynamics.cardiacOutput", value)
              }
              error={form.errors["hemodynamics.cardiacOutput"]}
              unit="L/min"
            />
            <NumberField
              label="Temperature"
              value={p.hemodynamics.temperatureC}
              onChange={(value) => form.set("hemodynamics.temperatureC", value)}
              error={form.errors["hemodynamics.temperatureC"]}
              unit="°C"
            />
            <VasoactiveList
              value={p.hemodynamics.vasoactives}
              onChange={(value) => form.set("hemodynamics.vasoactives", value)}
              errors={subErrors("hemodynamics.vasoactives")}
            />
            <SwitchField
              label="Thyroid hormone"
              value={p.hemodynamics.thyroidHormone}
              onChange={(value) =>
                form.set("hemodynamics.thyroidHormone", value)
              }
              error={form.errors["hemodynamics.thyroidHormone"]}
            />
            <SwitchField
              label="Steroids"
              value={p.hemodynamics.steroids}
              onChange={(value) => form.set("hemodynamics.steroids", value)}
              error={form.errors["hemodynamics.steroids"]}
            />
            <SelectField
              label="ECMO support"
              value={p.hemodynamics.ecmo}
              onChange={(value) => form.set("hemodynamics.ecmo", value)}
              error={form.errors["hemodynamics.ecmo"]}
              options={O.DONOR_ECMO}
            />
          </div>
        </FormSection>
        <FormSection id="echo" title="Echocardiography">
          <div className="grid gap-4 md:grid-cols-2">
            <DateField
              label="Echo date"
              value={p.echo.echoDate}
              onChange={(value) => form.set("echo.echoDate", value)}
              error={form.errors["echo.echoDate"]}
            />
            <NumberField
              label="LVEF"
              value={p.echo.lvef}
              onChange={(value) => form.set("echo.lvef", value)}
              error={form.errors["echo.lvef"]}
              unit="%"
            />
            <SelectField
              label="LVEF measurement method"
              value={p.echo.lvefMethod}
              onChange={(value) => form.set("echo.lvefMethod", value)}
              error={form.errors["echo.lvefMethod"]}
              options={O.LVEF_METHOD}
            />
            <NumberField
              label="Repeat LVEF after optimization"
              value={p.echo.repeatLvef}
              onChange={(value) => form.set("echo.repeatLvef", value)}
              error={form.errors["echo.repeatLvef"]}
              unit="%"
            />
            <NumberField
              label="Septal thickness"
              value={p.echo.septumMm}
              onChange={(value) => form.set("echo.septumMm", value)}
              error={form.errors["echo.septumMm"]}
              unit="mm"
            />
            <NumberField
              label="Posterior wall thickness"
              value={p.echo.posteriorWallMm}
              onChange={(value) => form.set("echo.posteriorWallMm", value)}
              error={form.errors["echo.posteriorWallMm"]}
              unit="mm"
            />
            <SelectField
              label="Wall motion"
              value={p.echo.wallMotion}
              onChange={(value) => form.set("echo.wallMotion", value)}
              error={form.errors["echo.wallMotion"]}
              options={O.WALL_MOTION}
            />
            <SelectField
              label="Valve disease"
              value={p.echo.valveDisease}
              onChange={(value) => form.set("echo.valveDisease", value)}
              error={form.errors["echo.valveDisease"]}
              options={O.VALVE_FINDING}
            />
            <SelectField
              label="Right ventricular function"
              value={p.echo.rvFunction}
              onChange={(value) => form.set("echo.rvFunction", value)}
              error={form.errors["echo.rvFunction"]}
              options={O.RV_FUNCTION}
            />
            <TriField
              label="Congenital abnormality"
              value={p.echo.congenitalAbnormality}
              onChange={(value) =>
                form.set("echo.congenitalAbnormality", value)
              }
              error={form.errors["echo.congenitalAbnormality"]}
            />
          </div>
        </FormSection>
        <FormSection id="coronary" title="Coronary">
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              label="Angiography"
              value={p.coronary.angiography}
              onChange={(value) => form.set("coronary.angiography", value)}
              error={form.errors["coronary.angiography"]}
              options={O.CORONARY_ANGIO}
            />
            <NumberField
              label="Coronary vessels with >50% stenosis"
              value={p.coronary.vesselsOver50}
              onChange={(value) => form.set("coronary.vesselsOver50", value)}
              error={form.errors["coronary.vesselsOver50"]}
              unit="count"
            />
            <SwitchField
              label="Left main disease"
              value={p.coronary.leftMainDisease}
              onChange={(value) => form.set("coronary.leftMainDisease", value)}
              error={form.errors["coronary.leftMainDisease"]}
            />
            <TriField
              label="Coronary anomaly"
              value={p.coronary.coronaryAnomaly}
              onChange={(value) => form.set("coronary.coronaryAnomaly", value)}
              error={form.errors["coronary.coronaryAnomaly"]}
            />
          </div>
        </FormSection>
        <FormSection id="ecg" title="Electrocardiogram">
          <div className="grid gap-4 md:grid-cols-2">
            <TriField
              label="ECG left ventricular hypertrophy criteria"
              value={p.ecg.lvhCriteria}
              onChange={(value) => form.set("ecg.lvhCriteria", value)}
              error={form.errors["ecg.lvhCriteria"]}
            />
            <TriField
              label="Ischemic changes"
              value={p.ecg.ischemicChanges}
              onChange={(value) => form.set("ecg.ischemicChanges", value)}
              error={form.errors["ecg.ischemicChanges"]}
            />
            <TriField
              label="Significant arrhythmia"
              value={p.ecg.significantArrhythmia}
              onChange={(value) => form.set("ecg.significantArrhythmia", value)}
              error={form.errors["ecg.significantArrhythmia"]}
            />
            <NumberField
              label="Corrected QT interval"
              value={p.ecg.qtcMs}
              onChange={(value) => form.set("ecg.qtcMs", value)}
              error={form.errors["ecg.qtcMs"]}
              unit="ms"
            />
          </div>
        </FormSection>
        <FormSection id="labs" title="Labs">
          <div className="grid gap-4 md:grid-cols-2">
            <NumberField
              label="Peak sodium"
              value={p.labs.sodiumPeak}
              onChange={(value) => form.set("labs.sodiumPeak", value)}
              error={form.errors["labs.sodiumPeak"]}
              unit="mmol/L"
            />
            <NumberField
              label="Latest sodium"
              value={p.labs.sodiumLatest}
              onChange={(value) => form.set("labs.sodiumLatest", value)}
              error={form.errors["labs.sodiumLatest"]}
              unit="mmol/L"
            />
            <NumberField
              label="Peak troponin I"
              value={p.labs.troponinIPeak}
              onChange={(value) => form.set("labs.troponinIPeak", value)}
              error={form.errors["labs.troponinIPeak"]}
              unit="ng/mL"
            />
            <NumberField
              label="Peak troponin T"
              value={p.labs.troponinTPeak}
              onChange={(value) => form.set("labs.troponinTPeak", value)}
              error={form.errors["labs.troponinTPeak"]}
              unit="ng/mL"
            />
            <NumberField
              label="CK-MB"
              value={p.labs.ckMb}
              onChange={(value) => form.set("labs.ckMb", value)}
              error={form.errors["labs.ckMb"]}
              unit="ng/mL"
            />
            <NumberField
              label="BNP"
              value={p.labs.bnp}
              onChange={(value) => form.set("labs.bnp", value)}
              error={form.errors["labs.bnp"]}
              unit="pg/mL"
            />
            <NumberField
              label="Creatinine"
              value={p.labs.creatinine}
              onChange={(value) => form.set("labs.creatinine", value)}
              error={form.errors["labs.creatinine"]}
              unit="mg/dL"
            />
            <NumberField
              label="Lactate"
              value={p.labs.lactate}
              onChange={(value) => form.set("labs.lactate", value)}
              error={form.errors["labs.lactate"]}
              unit="mmol/L"
            />
            <NumberField
              label="Arterial pH"
              value={p.labs.ph}
              onChange={(value) => form.set("labs.ph", value)}
              error={form.errors["labs.ph"]}
              unit="pH units"
            />
            <NumberField
              label="Arterial oxygen tension (PaO2)"
              value={p.labs.pao2}
              onChange={(value) => form.set("labs.pao2", value)}
              error={form.errors["labs.pao2"]}
              unit="mmHg"
            />
            <NumberField
              label="Inspired oxygen fraction (FiO2)"
              value={p.labs.fio2}
              onChange={(value) => form.set("labs.fio2", value)}
              error={form.errors["labs.fio2"]}
              unit="%"
            />
            <NumberField
              label="Hemoglobin"
              value={p.labs.hemoglobin}
              onChange={(value) => form.set("labs.hemoglobin", value)}
              error={form.errors["labs.hemoglobin"]}
              unit="g/dL"
            />
            <NumberField
              label="Glucose"
              value={p.labs.glucose}
              onChange={(value) => form.set("labs.glucose", value)}
              error={form.errors["labs.glucose"]}
              unit="mg/dL"
            />
            <NumberField
              label="AST"
              value={p.labs.ast}
              onChange={(value) => form.set("labs.ast", value)}
              error={form.errors["labs.ast"]}
              unit="U/L"
            />
            <NumberField
              label="ALT"
              value={p.labs.alt}
              onChange={(value) => form.set("labs.alt", value)}
              error={form.errors["labs.alt"]}
              unit="U/L"
            />
            <NumberField
              label="Bilirubin"
              value={p.labs.bilirubin}
              onChange={(value) => form.set("labs.bilirubin", value)}
              error={form.errors["labs.bilirubin"]}
              unit="mg/dL"
            />
          </div>
        </FormSection>
        <FormSection id="infection" title="Infection and serology">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <SerologyGrid
                value={p.infection.serology}
                onChange={(value) => form.set("infection.serology", value)}
                tests={O.DONOR_TESTS}
                errors={subErrors("infection.serology")}
              />
            </div>
            <SwitchField
              label="Infectious testing sample drawn within 96 hours"
              value={p.infection.sampleDrawnWithin96h}
              onChange={(value) =>
                form.set("infection.sampleDrawnWithin96h", value)
              }
              error={form.errors["infection.sampleDrawnWithin96h"]}
            />
            <TriField
              label="Blood culture positive"
              value={p.infection.bloodCulturePositive}
              onChange={(value) =>
                form.set("infection.bloodCulturePositive", value)
              }
              error={form.errors["infection.bloodCulturePositive"]}
            />
            <SwitchField
              label="Blood culture targeted therapy"
              value={p.infection.bloodCultureTargetedTherapy}
              onChange={(value) =>
                form.set("infection.bloodCultureTargetedTherapy", value)
              }
              error={form.errors["infection.bloodCultureTargetedTherapy"]}
            />
            <SelectField
              label="Central nervous system infection"
              value={p.infection.cnsInfection}
              onChange={(value) => form.set("infection.cnsInfection", value)}
              error={form.errors["infection.cnsInfection"]}
              options={O.CNS_INFECTION}
            />
            <SelectField
              label="Chest X-ray"
              value={p.infection.chestXray}
              onChange={(value) => form.set("infection.chestXray", value)}
              error={form.errors["infection.chestXray"]}
              options={O.CHEST_XRAY}
            />
          </div>
        </FormSection>
        <FormSection id="hla" title="HLA typing">
          <HlaTypingGrid
            value={p.hla}
            onChange={(value) => form.set("hla", value)}
            errors={subErrors("hla")}
          />
        </FormSection>
        <FormSection id="notes" title="Notes">
          <TextField
            label="Clinical notes"
            value={p.notes}
            onChange={(value) => form.set("notes", value)}
            error={form.errors.notes}
          />
        </FormSection>
        <div className="sticky bottom-0 flex flex-wrap gap-3 border bg-background p-4">
          <Button type="submit">Save donor</Button>
          <a href="/donors" className="px-3 py-2 underline">
            Cancel
          </a>
          <span className="py-2 text-sm text-muted-foreground">
            {form.dirty ? "Unsaved changes" : "All changes saved"}
          </span>
        </div>
      </div>
    </form>
  )
}
