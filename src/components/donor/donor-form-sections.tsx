import { memo } from "react"
import * as O from "@/domain/options"
import type { Donor } from "@/domain/schema"
import {
  TextField,
  NumberField,
  DateField,
  SelectField,
  TriField,
  SwitchField,
  FormSection,
  HlaTypingGrid,
  VasoactiveList,
  SerologyGrid,
  subErrors,
} from "@/components/form"
import type { SectionProps } from "@/components/form"

/*
 * One memoised component per section. Each receives only its own branch of the
 * form value, the stable `set`, and its own stable errors object, so a keystroke
 * re-renders the edited section and nothing else.
 */

export const IdentitySection = memo(function IdentityFields({
  value: v,
  errors,
  set,
}: SectionProps<Donor, "identity">) {
  return (
    <FormSection id="identity" title="Identity">
      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          id="field-identity.donorId"
          label="Donor ID *"
          value={v.donorId}
          onChange={(value) => set("identity.donorId", value)}
          error={errors.donorId}
        />
        <SelectField
          id="field-identity.state"
          label="State"
          value={v.state}
          onChange={(value) => set("identity.state", value)}
          error={errors.state}
          options={O.DONOR_STATE}
        />
        <TextField
          id="field-identity.donorHospital"
          label="Donor hospital"
          value={v.donorHospital}
          onChange={(value) => set("identity.donorHospital", value)}
          error={errors.donorHospital}
        />
        <TextField
          id="field-identity.opo"
          label="Organ procurement organization (OPO)"
          value={v.opo}
          onChange={(value) => set("identity.opo", value)}
          error={errors.opo}
        />
        <DateField
          id="field-identity.referralDate"
          disableFuture
          label="Referral date"
          value={v.referralDate}
          onChange={(value) => set("identity.referralDate", value)}
          error={errors.referralDate}
        />
        <NumberField
          id="field-identity.ageYears"
          label="Age"
          value={v.ageYears}
          onChange={(value) => set("identity.ageYears", value)}
          error={errors.ageYears}
          unit="years"
        />
        <SelectField
          id="field-identity.sex"
          label="Sex"
          value={v.sex}
          onChange={(value) => set("identity.sex", value)}
          error={errors.sex}
          options={O.SEX}
        />
        <SelectField
          id="field-identity.ethnicity"
          label="Ethnicity"
          value={v.ethnicity}
          onChange={(value) => set("identity.ethnicity", value)}
          error={errors.ethnicity}
          options={O.ETHNICITY}
        />
      </div>
    </FormSection>
  )
})

export const BodySection = memo(function BodyFields({
  value: v,
  errors,
  set,
}: SectionProps<Donor, "body">) {
  return (
    <FormSection id="body" title="Body measurements">
      <div className="grid gap-4 md:grid-cols-2">
        <NumberField
          id="field-body.heightCm"
          label="Height"
          value={v.heightCm}
          onChange={(value) => set("body.heightCm", value)}
          error={errors.heightCm}
          unit="cm"
        />
        <NumberField
          id="field-body.weightKg"
          label="Weight"
          value={v.weightKg}
          onChange={(value) => set("body.weightKg", value)}
          error={errors.weightKg}
          unit="kg"
        />
      </div>
    </FormSection>
  )
})

export const BloodSection = memo(function BloodFields({
  value: v,
  errors,
  set,
}: SectionProps<Donor, "blood">) {
  return (
    <FormSection id="blood" title="Blood type">
      <div className="grid gap-4 md:grid-cols-2">
        <SelectField
          id="field-blood.abo"
          label="ABO blood type"
          value={v.abo ?? ""}
          onChange={(value) => set("blood.abo", value === "" ? null : value)}
          options={[{ value: "", label: "Not recorded" }, ...O.ABO]}
          error={errors.abo}
        />
        <SelectField
          id="field-blood.subtype"
          label="Subtype"
          value={v.subtype}
          onChange={(value) => set("blood.subtype", value)}
          error={errors.subtype}
          options={O.ABO_SUBTYPE}
        />
        <SwitchField
          id="field-blood.verifiedTwoSamples"
          label="ABO verified by two independent samples"
          value={v.verifiedTwoSamples}
          onChange={(value) => set("blood.verifiedTwoSamples", value)}
          error={errors.verifiedTwoSamples}
        />
      </div>
    </FormSection>
  )
})

export const DonationSection = memo(function DonationFields({
  value: v,
  errors,
  set,
}: SectionProps<Donor, "donation">) {
  return (
    <FormSection id="donation" title="Donation">
      <div className="grid gap-4 md:grid-cols-2">
        <SelectField
          id="field-donation.type"
          label="Donation type"
          value={v.type}
          onChange={(value) => set("donation.type", value)}
          error={errors.type}
          options={O.DONATION_TYPE}
        />
        <DateField
          id="field-donation.brainDeathDate"
          disableFuture
          label="Brain death date"
          value={v.brainDeathDate}
          onChange={(value) => set("donation.brainDeathDate", value)}
          error={errors.brainDeathDate}
        />
        <SelectField
          id="field-donation.dcdRecovery"
          label="DCD recovery technique"
          value={v.dcdRecovery ?? ""}
          onChange={(value) =>
            set("donation.dcdRecovery", value === "" ? null : value)
          }
          options={[{ value: "", label: "Not recorded" }, ...O.DCD_RECOVERY]}
          error={errors.dcdRecovery}
        />
        <NumberField
          id="field-donation.agonalPhaseMinutes"
          label="Agonal phase minutes"
          value={v.agonalPhaseMinutes}
          onChange={(value) => set("donation.agonalPhaseMinutes", value)}
          error={errors.agonalPhaseMinutes}
          unit="min"
        />
        <NumberField
          id="field-donation.functionalWarmIschemiaMinutes"
          label="Functional warm ischemia minutes"
          value={v.functionalWarmIschemiaMinutes}
          onChange={(value) =>
            set("donation.functionalWarmIschemiaMinutes", value)
          }
          error={errors.functionalWarmIschemiaMinutes}
          unit="min"
        />
        <NumberField
          id="field-donation.noTouchMinutes"
          label="No touch minutes"
          value={v.noTouchMinutes}
          onChange={(value) => set("donation.noTouchMinutes", value)}
          error={errors.noTouchMinutes}
          unit="min"
        />
      </div>
    </FormSection>
  )
})

export const DeathSection = memo(function DeathFields({
  value: v,
  errors,
  set,
}: SectionProps<Donor, "death">) {
  return (
    <FormSection id="death" title="Death">
      <div className="grid gap-4 md:grid-cols-2">
        <SelectField
          id="field-death.cause"
          label="Cause"
          value={v.cause ?? ""}
          onChange={(value) => set("death.cause", value === "" ? null : value)}
          options={[{ value: "", label: "Not recorded" }, ...O.CAUSE_OF_DEATH]}
          error={errors.cause}
        />
        <SelectField
          id="field-death.mechanism"
          label="Mechanism"
          value={v.mechanism ?? ""}
          onChange={(value) =>
            set("death.mechanism", value === "" ? null : value)
          }
          options={[
            { value: "", label: "Not recorded" },
            ...O.MECHANISM_OF_DEATH,
          ]}
          error={errors.mechanism}
        />
        <SelectField
          id="field-death.circumstance"
          label="Circumstance"
          value={v.circumstance ?? ""}
          onChange={(value) =>
            set("death.circumstance", value === "" ? null : value)
          }
          options={[
            { value: "", label: "Not recorded" },
            ...O.CIRCUMSTANCE_OF_DEATH,
          ]}
          error={errors.circumstance}
        />
        <SwitchField
          id="field-death.carbonMonoxidePoisoning"
          label="Carbon monoxide poisoning"
          value={v.carbonMonoxidePoisoning}
          onChange={(value) => set("death.carbonMonoxidePoisoning", value)}
          error={errors.carbonMonoxidePoisoning}
        />
        <NumberField
          id="field-death.carboxyhemoglobinPct"
          label="Carboxyhemoglobin (COHb)"
          value={v.carboxyhemoglobinPct}
          onChange={(value) => set("death.carboxyhemoglobinPct", value)}
          error={errors.carboxyhemoglobinPct}
          unit="%"
        />
        <TriField
          id="field-death.cardiacArrest"
          label="Cardiac arrest"
          value={v.cardiacArrest}
          onChange={(value) => set("death.cardiacArrest", value)}
          error={errors.cardiacArrest}
        />
        <NumberField
          id="field-death.cprMinutes"
          label="CPR duration"
          value={v.cprMinutes}
          onChange={(value) => set("death.cprMinutes", value)}
          error={errors.cprMinutes}
          unit="min"
        />
        <SwitchField
          id="field-death.unexplainedSuddenDeath"
          label="Unexplained sudden death"
          value={v.unexplainedSuddenDeath}
          onChange={(value) => set("death.unexplainedSuddenDeath", value)}
          error={errors.unexplainedSuddenDeath}
        />
      </div>
    </FormSection>
  )
})

export const HistorySection = memo(function HistoryFields({
  value: v,
  errors,
  set,
}: SectionProps<Donor, "history">) {
  return (
    <FormSection id="history" title="History">
      <div className="grid gap-4 md:grid-cols-2">
        <SelectField
          id="field-history.hypertension"
          label="Hypertension"
          value={v.hypertension}
          onChange={(value) => set("history.hypertension", value)}
          error={errors.hypertension}
          options={O.HISTORY_DURATION}
        />
        <SelectField
          id="field-history.diabetes"
          label="Diabetes"
          value={v.diabetes}
          onChange={(value) => set("history.diabetes", value)}
          error={errors.diabetes}
          options={O.HISTORY_DURATION}
        />
        <SwitchField
          id="field-history.insulinDependent"
          label="Insulin dependent"
          value={v.insulinDependent}
          onChange={(value) => set("history.insulinDependent", value)}
          error={errors.insulinDependent}
        />
        <TriField
          id="field-history.cigarettesOver20PackYears"
          label="Smoking history >20 pack-years"
          value={v.cigarettesOver20PackYears}
          onChange={(value) => set("history.cigarettesOver20PackYears", value)}
          error={errors.cigarettesOver20PackYears}
        />
        <TriField
          id="field-history.cocaine"
          label="Cocaine"
          value={v.cocaine}
          onChange={(value) => set("history.cocaine", value)}
          error={errors.cocaine}
        />
        <TriField
          id="field-history.amphetamines"
          label="Amphetamines"
          value={v.amphetamines}
          onChange={(value) => set("history.amphetamines", value)}
          error={errors.amphetamines}
        />
        <TriField
          id="field-history.ivDrugUse"
          label="Intravenous drug use"
          value={v.ivDrugUse}
          onChange={(value) => set("history.ivDrugUse", value)}
          error={errors.ivDrugUse}
        />
        <TriField
          id="field-history.heavyAlcohol"
          label="Heavy alcohol"
          value={v.heavyAlcohol}
          onChange={(value) => set("history.heavyAlcohol", value)}
          error={errors.heavyAlcohol}
        />
        <TriField
          id="field-history.priorMi"
          label="Prior myocardial infarction"
          value={v.priorMi}
          onChange={(value) => set("history.priorMi", value)}
          error={errors.priorMi}
        />
        <TriField
          id="field-history.knownCad"
          label="Known coronary artery disease"
          value={v.knownCad}
          onChange={(value) => set("history.knownCad", value)}
          error={errors.knownCad}
        />
        <TriField
          id="field-history.priorCardiacSurgery"
          label="Prior cardiac surgery"
          value={v.priorCardiacSurgery}
          onChange={(value) => set("history.priorCardiacSurgery", value)}
          error={errors.priorCardiacSurgery}
        />
        <SelectField
          id="field-history.malignancyRisk"
          label="Malignancy risk"
          value={v.malignancyRisk}
          onChange={(value) => set("history.malignancyRisk", value)}
          error={errors.malignancyRisk}
          options={O.MALIGNANCY_RISK}
        />
        <TextField
          id="field-history.malignancyDetail"
          label="Malignancy detail"
          value={v.malignancyDetail}
          onChange={(value) => set("history.malignancyDetail", value)}
          error={errors.malignancyDetail}
        />
        <SelectField
          id="field-history.transfusionsThisAdmission"
          label="Transfusions this admission"
          value={v.transfusionsThisAdmission}
          onChange={(value) => set("history.transfusionsThisAdmission", value)}
          error={errors.transfusionsThisAdmission}
          options={O.TRANSFUSION_BAND}
        />
        <TriField
          id="field-history.bornInChagasEndemicCountry"
          label="Born in a Chagas-endemic country"
          value={v.bornInChagasEndemicCountry}
          onChange={(value) => set("history.bornInChagasEndemicCountry", value)}
          error={errors.bornInChagasEndemicCountry}
        />
        <fieldset data-guide="phs-criteria" className="space-y-3 md:col-span-2">
          <legend className="font-semibold">
            PHS 2020 risk criteria (last 30 days)
          </legend>
          {O.PHS_RISK_CRITERIA.map((option) => (
            <label key={option.value} className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={v.phsRiskCriteria.includes(option.value)}
                onChange={(event) =>
                  set(
                    "history.phsRiskCriteria",
                    event.target.checked
                      ? [...v.phsRiskCriteria, option.value]
                      : v.phsRiskCriteria.filter(
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
  )
})

export const HemodynamicsSection = memo(function HemodynamicsFields({
  value: v,
  errors,
  set,
}: SectionProps<Donor, "hemodynamics">) {
  return (
    <FormSection id="hemodynamics" title="Hemodynamics and support">
      <div className="grid gap-4 md:grid-cols-2">
        <NumberField
          id="field-hemodynamics.heartRate"
          label="Heart rate"
          value={v.heartRate}
          onChange={(value) => set("hemodynamics.heartRate", value)}
          error={errors.heartRate}
          unit="beats/min"
        />
        <NumberField
          id="field-hemodynamics.systolicBp"
          label="Systolic blood pressure"
          value={v.systolicBp}
          onChange={(value) => set("hemodynamics.systolicBp", value)}
          error={errors.systolicBp}
          unit="mmHg"
        />
        <NumberField
          id="field-hemodynamics.meanArterialPressure"
          label="Mean arterial pressure"
          value={v.meanArterialPressure}
          onChange={(value) => set("hemodynamics.meanArterialPressure", value)}
          error={errors.meanArterialPressure}
          unit="mmHg"
        />
        <NumberField
          id="field-hemodynamics.cvp"
          label="Central venous pressure"
          value={v.cvp}
          onChange={(value) => set("hemodynamics.cvp", value)}
          error={errors.cvp}
          unit="mmHg"
        />
        <NumberField
          id="field-hemodynamics.pcwp"
          label="Pulmonary capillary wedge pressure"
          value={v.pcwp}
          onChange={(value) => set("hemodynamics.pcwp", value)}
          error={errors.pcwp}
          unit="mmHg"
        />
        <NumberField
          id="field-hemodynamics.cardiacIndex"
          label="Cardiac index"
          value={v.cardiacIndex}
          onChange={(value) => set("hemodynamics.cardiacIndex", value)}
          error={errors.cardiacIndex}
          unit="L/min/m²"
        />
        <NumberField
          id="field-hemodynamics.cardiacOutput"
          label="Cardiac output"
          value={v.cardiacOutput}
          onChange={(value) => set("hemodynamics.cardiacOutput", value)}
          error={errors.cardiacOutput}
          unit="L/min"
        />
        <NumberField
          id="field-hemodynamics.temperatureC"
          label="Temperature"
          value={v.temperatureC}
          onChange={(value) => set("hemodynamics.temperatureC", value)}
          error={errors.temperatureC}
          unit="°C"
        />
        <div data-guide="vasoactives" className="md:col-span-2">
          <VasoactiveList
            value={v.vasoactives}
            onChange={(value) => set("hemodynamics.vasoactives", value)}
            errors={subErrors(errors, "vasoactives")}
          />
        </div>
        <SwitchField
          id="field-hemodynamics.thyroidHormone"
          label="Thyroid hormone"
          value={v.thyroidHormone}
          onChange={(value) => set("hemodynamics.thyroidHormone", value)}
          error={errors.thyroidHormone}
        />
        <SwitchField
          id="field-hemodynamics.steroids"
          label="Steroids"
          value={v.steroids}
          onChange={(value) => set("hemodynamics.steroids", value)}
          error={errors.steroids}
        />
        <SelectField
          id="field-hemodynamics.ecmo"
          label="ECMO support"
          value={v.ecmo}
          onChange={(value) => set("hemodynamics.ecmo", value)}
          error={errors.ecmo}
          options={O.DONOR_ECMO}
        />
      </div>
    </FormSection>
  )
})

export const EchoSection = memo(function EchoFields({
  value: v,
  errors,
  set,
}: SectionProps<Donor, "echo">) {
  return (
    <FormSection id="echo" title="Echocardiography">
      <div className="grid gap-4 md:grid-cols-2">
        <DateField
          id="field-echo.echoDate"
          disableFuture
          label="Echo date"
          value={v.echoDate}
          onChange={(value) => set("echo.echoDate", value)}
          error={errors.echoDate}
        />
        <NumberField
          id="field-echo.lvef"
          label="LVEF"
          value={v.lvef}
          onChange={(value) => set("echo.lvef", value)}
          error={errors.lvef}
          unit="%"
        />
        <SelectField
          id="field-echo.lvefMethod"
          label="LVEF measurement method"
          value={v.lvefMethod}
          onChange={(value) => set("echo.lvefMethod", value)}
          error={errors.lvefMethod}
          options={O.LVEF_METHOD}
        />
        <NumberField
          id="field-echo.repeatLvef"
          label="Repeat LVEF after optimization"
          value={v.repeatLvef}
          onChange={(value) => set("echo.repeatLvef", value)}
          error={errors.repeatLvef}
          unit="%"
        />
        <NumberField
          id="field-echo.septumMm"
          label="Septal thickness"
          value={v.septumMm}
          onChange={(value) => set("echo.septumMm", value)}
          error={errors.septumMm}
          unit="mm"
        />
        <NumberField
          id="field-echo.posteriorWallMm"
          label="Posterior wall thickness"
          value={v.posteriorWallMm}
          onChange={(value) => set("echo.posteriorWallMm", value)}
          error={errors.posteriorWallMm}
          unit="mm"
        />
        <SelectField
          id="field-echo.wallMotion"
          label="Wall motion"
          value={v.wallMotion}
          onChange={(value) => set("echo.wallMotion", value)}
          error={errors.wallMotion}
          options={O.WALL_MOTION}
        />
        <SelectField
          id="field-echo.valveDisease"
          label="Valve disease"
          value={v.valveDisease}
          onChange={(value) => set("echo.valveDisease", value)}
          error={errors.valveDisease}
          options={O.VALVE_FINDING}
        />
        <SelectField
          id="field-echo.rvFunction"
          label="Right ventricular function"
          value={v.rvFunction}
          onChange={(value) => set("echo.rvFunction", value)}
          error={errors.rvFunction}
          options={O.RV_FUNCTION}
        />
        <TriField
          id="field-echo.congenitalAbnormality"
          label="Congenital abnormality"
          value={v.congenitalAbnormality}
          onChange={(value) => set("echo.congenitalAbnormality", value)}
          error={errors.congenitalAbnormality}
        />
      </div>
    </FormSection>
  )
})

export const CoronarySection = memo(function CoronaryFields({
  value: v,
  errors,
  set,
}: SectionProps<Donor, "coronary">) {
  return (
    <FormSection id="coronary" title="Coronary">
      <div className="grid gap-4 md:grid-cols-2">
        <SelectField
          id="field-coronary.angiography"
          label="Angiography"
          value={v.angiography}
          onChange={(value) => set("coronary.angiography", value)}
          error={errors.angiography}
          options={O.CORONARY_ANGIO}
        />
        <NumberField
          id="field-coronary.vesselsOver50"
          label="Coronary vessels with >50% stenosis"
          value={v.vesselsOver50}
          onChange={(value) => set("coronary.vesselsOver50", value)}
          error={errors.vesselsOver50}
          unit="count"
        />
        <SwitchField
          id="field-coronary.leftMainDisease"
          label="Left main disease"
          value={v.leftMainDisease}
          onChange={(value) => set("coronary.leftMainDisease", value)}
          error={errors.leftMainDisease}
        />
        <TriField
          id="field-coronary.coronaryAnomaly"
          label="Coronary anomaly"
          value={v.coronaryAnomaly}
          onChange={(value) => set("coronary.coronaryAnomaly", value)}
          error={errors.coronaryAnomaly}
        />
      </div>
    </FormSection>
  )
})

export const EcgSection = memo(function EcgFields({
  value: v,
  errors,
  set,
}: SectionProps<Donor, "ecg">) {
  return (
    <FormSection id="ecg" title="Electrocardiogram">
      <div className="grid gap-4 md:grid-cols-2">
        <TriField
          id="field-ecg.lvhCriteria"
          label="ECG left ventricular hypertrophy criteria"
          value={v.lvhCriteria}
          onChange={(value) => set("ecg.lvhCriteria", value)}
          error={errors.lvhCriteria}
        />
        <TriField
          id="field-ecg.ischemicChanges"
          label="Ischemic changes"
          value={v.ischemicChanges}
          onChange={(value) => set("ecg.ischemicChanges", value)}
          error={errors.ischemicChanges}
        />
        <TriField
          id="field-ecg.significantArrhythmia"
          label="Significant arrhythmia"
          value={v.significantArrhythmia}
          onChange={(value) => set("ecg.significantArrhythmia", value)}
          error={errors.significantArrhythmia}
        />
        <NumberField
          id="field-ecg.qtcMs"
          label="Corrected QT interval"
          value={v.qtcMs}
          onChange={(value) => set("ecg.qtcMs", value)}
          error={errors.qtcMs}
          unit="ms"
        />
      </div>
    </FormSection>
  )
})

export const LabsSection = memo(function LabsFields({
  value: v,
  errors,
  set,
}: SectionProps<Donor, "labs">) {
  return (
    <FormSection id="labs" title="Labs">
      <div className="grid gap-4 md:grid-cols-2">
        <NumberField
          id="field-labs.sodiumPeak"
          label="Peak sodium"
          value={v.sodiumPeak}
          onChange={(value) => set("labs.sodiumPeak", value)}
          error={errors.sodiumPeak}
          unit="mmol/L"
        />
        <NumberField
          id="field-labs.sodiumLatest"
          label="Latest sodium"
          value={v.sodiumLatest}
          onChange={(value) => set("labs.sodiumLatest", value)}
          error={errors.sodiumLatest}
          unit="mmol/L"
        />
        <NumberField
          id="field-labs.troponinIPeak"
          label="Peak troponin I"
          value={v.troponinIPeak}
          onChange={(value) => set("labs.troponinIPeak", value)}
          error={errors.troponinIPeak}
          unit="ng/mL"
        />
        <NumberField
          id="field-labs.troponinTPeak"
          label="Peak troponin T"
          value={v.troponinTPeak}
          onChange={(value) => set("labs.troponinTPeak", value)}
          error={errors.troponinTPeak}
          unit="ng/mL"
        />
        <NumberField
          id="field-labs.ckMb"
          label="CK-MB"
          value={v.ckMb}
          onChange={(value) => set("labs.ckMb", value)}
          error={errors.ckMb}
          unit="ng/mL"
        />
        <NumberField
          id="field-labs.bnp"
          label="BNP"
          value={v.bnp}
          onChange={(value) => set("labs.bnp", value)}
          error={errors.bnp}
          unit="pg/mL"
        />
        <NumberField
          id="field-labs.creatinine"
          label="Creatinine"
          value={v.creatinine}
          onChange={(value) => set("labs.creatinine", value)}
          error={errors.creatinine}
          unit="mg/dL"
        />
        <NumberField
          id="field-labs.lactate"
          label="Lactate"
          value={v.lactate}
          onChange={(value) => set("labs.lactate", value)}
          error={errors.lactate}
          unit="mmol/L"
        />
        <NumberField
          id="field-labs.ph"
          label="Arterial pH"
          value={v.ph}
          onChange={(value) => set("labs.ph", value)}
          error={errors.ph}
          unit="pH units"
        />
        <NumberField
          id="field-labs.pao2"
          label="Arterial oxygen tension (PaO2)"
          value={v.pao2}
          onChange={(value) => set("labs.pao2", value)}
          error={errors.pao2}
          unit="mmHg"
        />
        <NumberField
          id="field-labs.fio2"
          label="Inspired oxygen fraction (FiO2)"
          value={v.fio2}
          onChange={(value) => set("labs.fio2", value)}
          error={errors.fio2}
          unit="%"
        />
        <NumberField
          id="field-labs.hemoglobin"
          label="Hemoglobin"
          value={v.hemoglobin}
          onChange={(value) => set("labs.hemoglobin", value)}
          error={errors.hemoglobin}
          unit="g/dL"
        />
        <NumberField
          id="field-labs.glucose"
          label="Glucose"
          value={v.glucose}
          onChange={(value) => set("labs.glucose", value)}
          error={errors.glucose}
          unit="mg/dL"
        />
        <NumberField
          id="field-labs.ast"
          label="AST"
          value={v.ast}
          onChange={(value) => set("labs.ast", value)}
          error={errors.ast}
          unit="U/L"
        />
        <NumberField
          id="field-labs.alt"
          label="ALT"
          value={v.alt}
          onChange={(value) => set("labs.alt", value)}
          error={errors.alt}
          unit="U/L"
        />
        <NumberField
          id="field-labs.bilirubin"
          label="Bilirubin"
          value={v.bilirubin}
          onChange={(value) => set("labs.bilirubin", value)}
          error={errors.bilirubin}
          unit="mg/dL"
        />
      </div>
    </FormSection>
  )
})

export const InfectionSection = memo(function InfectionFields({
  value: v,
  errors,
  set,
}: SectionProps<Donor, "infection">) {
  return (
    <FormSection id="infection" title="Infection and serology">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <SerologyGrid
            value={v.serology}
            onChange={(value) => set("infection.serology", value)}
            tests={O.DONOR_TESTS}
            errors={subErrors(errors, "serology")}
          />
        </div>
        <SwitchField
          id="field-infection.sampleDrawnWithin96h"
          label="Infectious testing sample drawn within 96 hours"
          value={v.sampleDrawnWithin96h}
          onChange={(value) => set("infection.sampleDrawnWithin96h", value)}
          error={errors.sampleDrawnWithin96h}
        />
        <TriField
          id="field-infection.bloodCulturePositive"
          label="Blood culture positive"
          value={v.bloodCulturePositive}
          onChange={(value) => set("infection.bloodCulturePositive", value)}
          error={errors.bloodCulturePositive}
        />
        <SwitchField
          id="field-infection.bloodCultureTargetedTherapy"
          label="Blood culture targeted therapy"
          value={v.bloodCultureTargetedTherapy}
          onChange={(value) =>
            set("infection.bloodCultureTargetedTherapy", value)
          }
          error={errors.bloodCultureTargetedTherapy}
        />
        <SelectField
          id="field-infection.cnsInfection"
          label="Central nervous system infection"
          value={v.cnsInfection}
          onChange={(value) => set("infection.cnsInfection", value)}
          error={errors.cnsInfection}
          options={O.CNS_INFECTION}
        />
        <SelectField
          id="field-infection.chestXray"
          label="Chest X-ray"
          value={v.chestXray}
          onChange={(value) => set("infection.chestXray", value)}
          error={errors.chestXray}
          options={O.CHEST_XRAY}
        />
      </div>
    </FormSection>
  )
})

export const HlaSection = memo(function HlaFields({
  value: v,
  errors,
  set,
}: SectionProps<Donor, "hla">) {
  return (
    <FormSection id="hla" title="HLA typing">
      <HlaTypingGrid
        value={v}
        onChange={(value) => set("hla", value)}
        errors={errors}
      />
    </FormSection>
  )
})

export const NotesSection = memo(function NotesFields({
  value: v,
  errors,
  set,
}: SectionProps<Donor, "notes">) {
  return (
    <FormSection id="notes" title="Notes">
      <TextField
        id="field-notes"
        label="Clinical notes"
        value={v}
        onChange={(value) => set("notes", value)}
        error={errors.notes}
      />
    </FormSection>
  )
})
