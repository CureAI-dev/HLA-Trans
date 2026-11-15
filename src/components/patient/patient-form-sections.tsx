import { memo } from "react"
import * as O from "@/domain/options"
import type { Patient } from "@/domain/schema"
import {
  TextField,
  NumberField,
  DateField,
  SelectField,
  TriField,
  SwitchField,
  FormSection,
  HlaTypingGrid,
  AntibodyTable,
  VasoactiveList,
  SerologyGrid,
  subErrors,
} from "@/components/form"
import type { SectionProps } from "@/components/form"

/** Form value: the patient plus the raw comma-separated unacceptable-antigens text being typed. */
export type PatientFormValue = Patient & { unacceptableAntigensText: string }

/*
 * One memoised component per section. Each receives only its own branch of the
 * form value, the stable `set`, and its own stable errors object, so a keystroke
 * re-renders the edited section and nothing else.
 */

export const IdentitySection = memo(function IdentityFields({
  value: v,
  errors,
  set,
}: SectionProps<PatientFormValue, "identity">) {
  return (
    <FormSection id="identity" title="Identity">
      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          id="field-identity.mrn"
          label="Medical record number *"
          value={v.mrn}
          onChange={(value) => set("identity.mrn", value)}
          error={errors.mrn}
        />
        <TextField
          id="field-identity.firstName"
          label="First name *"
          value={v.firstName}
          onChange={(value) => set("identity.firstName", value)}
          error={errors.firstName}
        />
        <TextField
          id="field-identity.lastName"
          label="Last name *"
          value={v.lastName}
          onChange={(value) => set("identity.lastName", value)}
          error={errors.lastName}
        />
        <DateField
          id="field-identity.dateOfBirth"
          captionLayout="dropdown"
          disableFuture
          label="Date of birth *"
          value={v.dateOfBirth}
          onChange={(value) => set("identity.dateOfBirth", value)}
          error={errors.dateOfBirth}
        />
        <SelectField
          id="field-identity.sex"
          label="Sex *"
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
        <TextField
          id="field-identity.transplantCenter"
          label="Transplant center"
          value={v.transplantCenter}
          onChange={(value) => set("identity.transplantCenter", value)}
          error={errors.transplantCenter}
        />
        <TextField
          id="field-identity.attendingPhysician"
          label="Attending physician"
          value={v.attendingPhysician}
          onChange={(value) => set("identity.attendingPhysician", value)}
          error={errors.attendingPhysician}
        />
      </div>
    </FormSection>
  )
})

export const ListingSection = memo(function ListingFields({
  value: v,
  errors,
  set,
}: SectionProps<PatientFormValue, "listing">) {
  return (
    <FormSection id="listing" title="Listing">
      <div className="grid gap-4 md:grid-cols-2">
        <SelectField
          id="field-listing.state"
          label="State"
          value={v.state}
          onChange={(value) => set("listing.state", value)}
          error={errors.state}
          options={O.CANDIDATE_STATE}
        />
        <DateField
          id="field-listing.listingDate"
          disableFuture
          label="Listing date"
          value={v.listingDate}
          onChange={(value) => set("listing.listingDate", value)}
          error={errors.listingDate}
        />
        <SelectField
          id="field-listing.urgencyStatus"
          label="Urgency status"
          value={v.urgencyStatus ?? ""}
          onChange={(value) =>
            set("listing.urgencyStatus", value === "" ? null : value)
          }
          options={[{ value: "", label: "Not recorded" }, ...O.URGENCY_STATUS]}
          error={errors.urgencyStatus}
        />
        <TextField
          id="field-listing.statusCriterion"
          label="Status criterion"
          value={v.statusCriterion}
          onChange={(value) => set("listing.statusCriterion", value)}
          error={errors.statusCriterion}
        />
        <DateField
          id="field-listing.statusDate"
          disableFuture
          label="Status date"
          value={v.statusDate}
          onChange={(value) => set("listing.statusDate", value)}
          error={errors.statusDate}
        />
        <DateField
          id="field-listing.statusExpiresOn"
          label="Status expires on"
          value={v.statusExpiresOn}
          onChange={(value) => set("listing.statusExpiresOn", value)}
          error={errors.statusExpiresOn}
        />
        <SwitchField
          id="field-listing.multiOrgan"
          label="Multi-organ candidate"
          value={v.multiOrgan}
          onChange={(value) => set("listing.multiOrgan", value)}
          error={errors.multiOrgan}
        />
        <TextField
          id="field-listing.otherOrgans"
          label="Other organs"
          value={v.otherOrgans}
          onChange={(value) => set("listing.otherOrgans", value)}
          error={errors.otherOrgans}
        />
      </div>
    </FormSection>
  )
})

export const BodySection = memo(function BodyFields({
  value: v,
  errors,
  set,
}: SectionProps<PatientFormValue, "body">) {
  return (
    <FormSection id="body" title="Body">
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
}: SectionProps<PatientFormValue, "blood">) {
  return (
    <FormSection id="blood" title="Blood type">
      <div className="grid gap-4 md:grid-cols-2">
        <SelectField
          id="field-blood.abo"
          label="ABO blood group"
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
        <SwitchField
          id="field-blood.acceptsIncompatible"
          label="Accept intended ABO-incompatible pediatric offers"
          value={v.acceptsIncompatible}
          onChange={(value) => set("blood.acceptsIncompatible", value)}
          error={errors.acceptsIncompatible}
        />
        <NumberField
          id="field-blood.antiATiter"
          label="Anti-A titer denominator (1:x)"
          value={v.antiATiter}
          onChange={(value) => set("blood.antiATiter", value)}
          error={errors.antiATiter}
          unit="denominator"
        />
        <NumberField
          id="field-blood.antiBTiter"
          label="Anti-B titer denominator (1:x)"
          value={v.antiBTiter}
          onChange={(value) => set("blood.antiBTiter", value)}
          error={errors.antiBTiter}
          unit="denominator"
        />
        <DateField
          id="field-blood.titerDate"
          disableFuture
          label="Titer date"
          value={v.titerDate}
          onChange={(value) => set("blood.titerDate", value)}
          error={errors.titerDate}
        />
        <SwitchField
          id="field-blood.titerLoweringTherapyWithin30Days"
          label="Titer-lowering therapy within 30 days"
          value={v.titerLoweringTherapyWithin30Days}
          onChange={(value) =>
            set("blood.titerLoweringTherapyWithin30Days", value)
          }
          error={errors.titerLoweringTherapyWithin30Days}
        />
      </div>
    </FormSection>
  )
})

export const DiagnosisSection = memo(function DiagnosisFields({
  value: v,
  errors,
  set,
}: SectionProps<PatientFormValue, "diagnosis">) {
  return (
    <FormSection id="diagnosis" title="Diagnosis">
      <div className="grid gap-4 md:grid-cols-2">
        <SelectField
          id="field-diagnosis.primary"
          label="Primary heart diagnosis"
          value={v.primary ?? ""}
          onChange={(value) =>
            set("diagnosis.primary", value === "" ? null : value)
          }
          options={[{ value: "", label: "Not recorded" }, ...O.HEART_DIAGNOSIS]}
          error={errors.primary}
        />
        <TextField
          id="field-diagnosis.detail"
          label="Detail"
          value={v.detail}
          onChange={(value) => set("diagnosis.detail", value)}
          error={errors.detail}
        />
        <DateField
          id="field-diagnosis.diagnosisDate"
          disableFuture
          label="Diagnosis date"
          value={v.diagnosisDate}
          onChange={(value) => set("diagnosis.diagnosisDate", value)}
          error={errors.diagnosisDate}
        />
      </div>
    </FormSection>
  )
})

export const HemodynamicsSection = memo(function HemodynamicsFields({
  value: v,
  errors,
  set,
}: SectionProps<PatientFormValue, "hemodynamics">) {
  return (
    <FormSection id="hemodynamics" title="Hemodynamics">
      <div className="grid gap-4 md:grid-cols-2">
        <DateField
          id="field-hemodynamics.catheterizationDate"
          disableFuture
          label="Catheterization date"
          value={v.catheterizationDate}
          onChange={(value) => set("hemodynamics.catheterizationDate", value)}
          error={errors.catheterizationDate}
        />
        <NumberField
          id="field-hemodynamics.paSystolic"
          label="PA systolic pressure"
          value={v.paSystolic}
          onChange={(value) => set("hemodynamics.paSystolic", value)}
          error={errors.paSystolic}
          unit="mmHg"
        />
        <NumberField
          id="field-hemodynamics.paDiastolic"
          label="PA diastolic pressure"
          value={v.paDiastolic}
          onChange={(value) => set("hemodynamics.paDiastolic", value)}
          error={errors.paDiastolic}
          unit="mmHg"
        />
        <NumberField
          id="field-hemodynamics.paMean"
          label="PA mean pressure (measured)"
          value={v.paMean}
          onChange={(value) => set("hemodynamics.paMean", value)}
          error={errors.paMean}
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
          id="field-hemodynamics.rap"
          label="Right atrial pressure"
          value={v.rap}
          onChange={(value) => set("hemodynamics.rap", value)}
          error={errors.rap}
          unit="mmHg"
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
          id="field-hemodynamics.cardiacIndex"
          label="Cardiac index"
          value={v.cardiacIndex}
          onChange={(value) => set("hemodynamics.cardiacIndex", value)}
          error={errors.cardiacIndex}
          unit="L/min/m^2"
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
          id="field-hemodynamics.mixedVenousSat"
          label="Mixed venous oxygen saturation"
          value={v.mixedVenousSat}
          onChange={(value) => set("hemodynamics.mixedVenousSat", value)}
          error={errors.mixedVenousSat}
          unit="%"
        />
        <SwitchField
          id="field-hemodynamics.onInotropesDuringCath"
          label="On inotropes during cath"
          value={v.onInotropesDuringCath}
          onChange={(value) => set("hemodynamics.onInotropesDuringCath", value)}
          error={errors.onInotropesDuringCath}
        />
        <SwitchField
          id="field-hemodynamics.vasodilatorChallengeDone"
          label="Vasodilator challenge done"
          value={v.vasodilatorChallengeDone}
          onChange={(value) =>
            set("hemodynamics.vasodilatorChallengeDone", value)
          }
          error={errors.vasodilatorChallengeDone}
        />
        <NumberField
          id="field-hemodynamics.pvrAfterChallenge"
          label="PVR after vasodilator challenge"
          value={v.pvrAfterChallenge}
          onChange={(value) => set("hemodynamics.pvrAfterChallenge", value)}
          error={errors.pvrAfterChallenge}
          unit="WU"
        />
      </div>
    </FormSection>
  )
})

export const SupportSection = memo(function SupportFields({
  value: v,
  errors,
  set,
}: SectionProps<PatientFormValue, "support">) {
  return (
    <FormSection id="support" title="Support">
      <div className="grid gap-4 md:grid-cols-2">
        <SelectField
          id="field-support.device"
          label="Device"
          value={v.device}
          onChange={(value) => set("support.device", value)}
          error={errors.device}
          options={O.MCS_DEVICE}
        />
        <TextField
          id="field-support.deviceBrand"
          label="Device brand"
          value={v.deviceBrand}
          onChange={(value) => set("support.deviceBrand", value)}
          error={errors.deviceBrand}
        />
        <DateField
          id="field-support.deviceImplantDate"
          disableFuture
          label="Device implant date"
          value={v.deviceImplantDate}
          onChange={(value) => set("support.deviceImplantDate", value)}
          error={errors.deviceImplantDate}
        />
        <div className="md:col-span-2">
          <VasoactiveList
            value={v.inotropes}
            onChange={(value) => set("support.inotropes", value)}
            errors={subErrors(errors, "inotropes")}
          />
        </div>
        <SwitchField
          id="field-support.mechanicalVentilation"
          label="Mechanical ventilation"
          value={v.mechanicalVentilation}
          onChange={(value) => set("support.mechanicalVentilation", value)}
          error={errors.mechanicalVentilation}
        />
        <SwitchField
          id="field-support.inhaledNitricOxide"
          label="Inhaled nitric oxide"
          value={v.inhaledNitricOxide}
          onChange={(value) => set("support.inhaledNitricOxide", value)}
          error={errors.inhaledNitricOxide}
        />
        <SwitchField
          id="field-support.icd"
          label="Implantable cardioverter defibrillator"
          value={v.icd}
          onChange={(value) => set("support.icd", value)}
          error={errors.icd}
        />
      </div>
    </FormSection>
  )
})

export const FunctionSection = memo(function FunctionFields({
  value: v,
  errors,
  set,
}: SectionProps<PatientFormValue, "function">) {
  return (
    <FormSection id="function" title="Function">
      <div className="grid gap-4 md:grid-cols-2">
        <NumberField
          id="field-function.lvef"
          label="Left ventricular ejection fraction"
          value={v.lvef}
          onChange={(value) => set("function.lvef", value)}
          error={errors.lvef}
          unit="%"
        />
        <SelectField
          id="field-function.nyha"
          label="NYHA functional class"
          value={v.nyha ?? ""}
          onChange={(value) =>
            set("function.nyha", value === "" ? null : value)
          }
          options={[{ value: "", label: "Not recorded" }, ...O.NYHA]}
          error={errors.nyha}
        />
        <NumberField
          id="field-function.peakVo2"
          label="Peak VO2"
          value={v.peakVo2}
          onChange={(value) => set("function.peakVo2", value)}
          error={errors.peakVo2}
          unit="mL/kg/min"
        />
        <SwitchField
          id="field-function.onBetaBlocker"
          label="On beta blocker"
          value={v.onBetaBlocker}
          onChange={(value) => set("function.onBetaBlocker", value)}
          error={errors.onBetaBlocker}
        />
        <SwitchField
          id="field-function.hospitalized"
          label="Hospitalized"
          value={v.hospitalized}
          onChange={(value) => set("function.hospitalized", value)}
          error={errors.hospitalized}
        />
        <SwitchField
          id="field-function.inIcu"
          label="In intensive care"
          value={v.inIcu}
          onChange={(value) => set("function.inIcu", value)}
          error={errors.inIcu}
        />
      </div>
    </FormSection>
  )
})

export const LabsSection = memo(function LabsFields({
  value: v,
  errors,
  set,
}: SectionProps<PatientFormValue, "labs">) {
  return (
    <FormSection id="labs" title="Labs">
      <div className="grid gap-4 md:grid-cols-2">
        <DateField
          id="field-labs.labDate"
          disableFuture
          label="Lab date"
          value={v.labDate}
          onChange={(value) => set("labs.labDate", value)}
          error={errors.labDate}
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
          id="field-labs.egfr"
          label="Estimated GFR"
          value={v.egfr}
          onChange={(value) => set("labs.egfr", value)}
          error={errors.egfr}
          unit="mL/min/1.73 m^2"
        />
        <SelectField
          id="field-labs.dialysis"
          label="Dialysis"
          value={v.dialysis}
          onChange={(value) => set("labs.dialysis", value)}
          error={errors.dialysis}
          options={O.DIALYSIS}
        />
        <NumberField
          id="field-labs.bilirubin"
          label="Bilirubin"
          value={v.bilirubin}
          onChange={(value) => set("labs.bilirubin", value)}
          error={errors.bilirubin}
          unit="mg/dL"
        />
        <NumberField
          id="field-labs.albumin"
          label="Albumin"
          value={v.albumin}
          onChange={(value) => set("labs.albumin", value)}
          error={errors.albumin}
          unit="g/dL"
        />
        <NumberField
          id="field-labs.inr"
          label="INR"
          value={v.inr}
          onChange={(value) => set("labs.inr", value)}
          error={errors.inr}
          unit="ratio"
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
          id="field-labs.sodium"
          label="Sodium"
          value={v.sodium}
          onChange={(value) => set("labs.sodium", value)}
          error={errors.sodium}
          unit="mmol/L"
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
          id="field-labs.ntProBnp"
          label="NT-proBNP"
          value={v.ntProBnp}
          onChange={(value) => set("labs.ntProBnp", value)}
          error={errors.ntProBnp}
          unit="pg/mL"
        />
        <NumberField
          id="field-labs.hba1c"
          label="HbA1c"
          value={v.hba1c}
          onChange={(value) => set("labs.hba1c", value)}
          error={errors.hba1c}
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
          id="field-labs.lactate"
          label="Lactate"
          value={v.lactate}
          onChange={(value) => set("labs.lactate", value)}
          error={errors.lactate}
          unit="mmol/L"
        />
      </div>
    </FormSection>
  )
})

export const HistorySection = memo(function HistoryFields({
  value: v,
  errors,
  set,
}: SectionProps<PatientFormValue, "history">) {
  return (
    <FormSection id="history" title="History">
      <div className="grid gap-4 md:grid-cols-2">
        <SelectField
          id="field-history.diabetes"
          label="Diabetes"
          value={v.diabetes}
          onChange={(value) => set("history.diabetes", value)}
          error={errors.diabetes}
          options={O.DIABETES}
        />
        <SwitchField
          id="field-history.diabetesEndOrganDamage"
          label="Diabetes end organ damage"
          value={v.diabetesEndOrganDamage}
          onChange={(value) => set("history.diabetesEndOrganDamage", value)}
          error={errors.diabetesEndOrganDamage}
        />
        <NumberField
          id="field-history.priorSternotomies"
          label="Prior sternotomies"
          value={v.priorSternotomies}
          onChange={(value) => set("history.priorSternotomies", value)}
          error={errors.priorSternotomies}
          unit="count"
        />
        <TextField
          id="field-history.priorCardiacSurgery"
          label="Prior cardiac surgery details"
          value={v.priorCardiacSurgery}
          onChange={(value) => set("history.priorCardiacSurgery", value)}
          error={errors.priorCardiacSurgery}
        />
        <TriField
          id="field-history.malignancyHistory"
          label="Malignancy history"
          value={v.malignancyHistory}
          onChange={(value) => set("history.malignancyHistory", value)}
          error={errors.malignancyHistory}
        />
        <TextField
          id="field-history.malignancyDetail"
          label="Malignancy detail"
          value={v.malignancyDetail}
          onChange={(value) => set("history.malignancyDetail", value)}
          error={errors.malignancyDetail}
        />
        <TriField
          id="field-history.cerebrovascularDisease"
          label="Cerebrovascular disease"
          value={v.cerebrovascularDisease}
          onChange={(value) => set("history.cerebrovascularDisease", value)}
          error={errors.cerebrovascularDisease}
        />
        <TriField
          id="field-history.peripheralVascularDisease"
          label="Peripheral vascular disease"
          value={v.peripheralVascularDisease}
          onChange={(value) => set("history.peripheralVascularDisease", value)}
          error={errors.peripheralVascularDisease}
        />
        <SelectField
          id="field-history.smoking"
          label="Smoking"
          value={v.smoking}
          onChange={(value) => set("history.smoking", value)}
          error={errors.smoking}
          options={O.SMOKING}
        />
        <DateField
          id="field-history.smokingQuitDate"
          disableFuture
          label="Smoking quit date"
          value={v.smokingQuitDate}
          onChange={(value) => set("history.smokingQuitDate", value)}
          error={errors.smokingQuitDate}
        />
        <TriField
          id="field-history.substanceUse"
          label="Substance use"
          value={v.substanceUse}
          onChange={(value) => set("history.substanceUse", value)}
          error={errors.substanceUse}
        />
        <TriField
          id="field-history.frailty"
          label="Frailty"
          value={v.frailty}
          onChange={(value) => set("history.frailty", value)}
          error={errors.frailty}
        />
        <TextField
          id="field-history.psychosocialConcerns"
          label="Psychosocial concerns"
          value={v.psychosocialConcerns}
          onChange={(value) => set("history.psychosocialConcerns", value)}
          error={errors.psychosocialConcerns}
        />
      </div>
    </FormSection>
  )
})

export const SensitizationSection = memo(function SensitizationFields({
  value: v,
  errors,
  set,
  unacceptableAntigensText,
}: SectionProps<PatientFormValue, "sensitization"> &
  Pick<PatientFormValue, "unacceptableAntigensText">) {
  return (
    <FormSection id="sensitization" title="Sensitization">
      <div className="grid gap-4 md:grid-cols-2">
        <NumberField
          id="field-sensitization.cpra"
          label="Current cPRA (reported by lab)"
          value={v.cpra}
          onChange={(value) => set("sensitization.cpra", value)}
          error={errors.cpra}
          unit="%"
        />
        <NumberField
          id="field-sensitization.cpraPeak"
          label="Peak cPRA"
          value={v.cpraPeak}
          onChange={(value) => set("sensitization.cpraPeak", value)}
          error={errors.cpraPeak}
          unit="%"
        />
        <DateField
          id="field-sensitization.cpraDate"
          disableFuture
          label="cPRA test date"
          value={v.cpraDate}
          onChange={(value) => set("sensitization.cpraDate", value)}
          error={errors.cpraDate}
        />
        <NumberField
          id="field-sensitization.pregnancies"
          label="Pregnancies"
          value={v.pregnancies}
          onChange={(value) => set("sensitization.pregnancies", value)}
          error={errors.pregnancies}
          unit="count"
        />
        <SelectField
          id="field-sensitization.transfusions"
          label="Transfusions"
          value={v.transfusions}
          onChange={(value) => set("sensitization.transfusions", value)}
          error={errors.transfusions}
          options={O.TRANSFUSION_BAND}
        />
        <NumberField
          id="field-sensitization.priorTransplants"
          label="Prior transplants"
          value={v.priorTransplants}
          onChange={(value) => set("sensitization.priorTransplants", value)}
          error={errors.priorTransplants}
          unit="count"
        />
        <SwitchField
          id="field-sensitization.priorHomograft"
          label="Prior homograft"
          value={v.priorHomograft}
          onChange={(value) => set("sensitization.priorHomograft", value)}
          error={errors.priorHomograft}
        />
        <TextField
          id="field-sensitization.desensitization"
          label="Desensitization notes"
          value={v.desensitization}
          onChange={(value) => set("sensitization.desensitization", value)}
          error={errors.desensitization}
        />
        <div className="md:col-span-2">
          <AntibodyTable
            value={v.antibodies}
            onChange={(value) => set("sensitization.antibodies", value)}
            errors={subErrors(errors, "antibodies")}
          />
        </div>
        <TextField
          id="field-sensitization.unacceptableAntigens"
          label="Unacceptable antigens (comma separated)"
          value={unacceptableAntigensText}
          onChange={(value) => {
            set("unacceptableAntigensText", value)
            set(
              "sensitization.unacceptableAntigens",
              value
                .split(",")
                .map((token) => token.trim())
                .filter(Boolean)
            )
          }}
          error={
            errors.unacceptableAntigens ||
            Object.values(subErrors(errors, "unacceptableAntigens")).join(
              "; "
            ) ||
            undefined
          }
        />
      </div>
    </FormSection>
  )
})

export const AcceptanceSection = memo(function AcceptanceFields({
  value: v,
  errors,
  set,
}: SectionProps<PatientFormValue, "acceptance">) {
  return (
    <FormSection id="acceptance" title="Acceptance">
      <div className="grid gap-4 md:grid-cols-2">
        <NumberField
          id="field-acceptance.maxDonorAge"
          label="Maximum donor age"
          value={v.maxDonorAge}
          onChange={(value) => set("acceptance.maxDonorAge", value)}
          error={errors.maxDonorAge}
          unit="years"
        />
        <NumberField
          id="field-acceptance.minDonorWeightKg"
          label="Minimum donor weight"
          value={v.minDonorWeightKg}
          onChange={(value) => set("acceptance.minDonorWeightKg", value)}
          error={errors.minDonorWeightKg}
          unit="kg"
        />
        <NumberField
          id="field-acceptance.maxDonorWeightKg"
          label="Maximum donor weight"
          value={v.maxDonorWeightKg}
          onChange={(value) => set("acceptance.maxDonorWeightKg", value)}
          error={errors.maxDonorWeightKg}
          unit="kg"
        />
        <NumberField
          id="field-acceptance.maxDistanceNm"
          label="Maximum donor distance"
          value={v.maxDistanceNm}
          onChange={(value) => set("acceptance.maxDistanceNm", value)}
          error={errors.maxDistanceNm}
          unit="NM"
        />
        <SwitchField
          id="field-acceptance.acceptDcd"
          label="Accept donation after circulatory death (DCD)"
          value={v.acceptDcd}
          onChange={(value) => set("acceptance.acceptDcd", value)}
          error={errors.acceptDcd}
        />
        <SwitchField
          id="field-acceptance.acceptHcvNat"
          label="Accept HCV NAT positive"
          value={v.acceptHcvNat}
          onChange={(value) => set("acceptance.acceptHcvNat", value)}
          error={errors.acceptHcvNat}
        />
        <SwitchField
          id="field-acceptance.acceptHcvAb"
          label="Accept HCV antibody positive"
          value={v.acceptHcvAb}
          onChange={(value) => set("acceptance.acceptHcvAb", value)}
          error={errors.acceptHcvAb}
        />
        <SwitchField
          id="field-acceptance.acceptAntiHbc"
          label="Accept anti-HBc positive"
          value={v.acceptAntiHbc}
          onChange={(value) => set("acceptance.acceptAntiHbc", value)}
          error={errors.acceptAntiHbc}
        />
        <SwitchField
          id="field-acceptance.acceptHbvNat"
          label="Accept HBV NAT positive"
          value={v.acceptHbvNat}
          onChange={(value) => set("acceptance.acceptHbvNat", value)}
          error={errors.acceptHbvNat}
        />
        <SwitchField
          id="field-acceptance.acceptPhsRisk"
          label="Accept PHS risk criteria"
          value={v.acceptPhsRisk}
          onChange={(value) => set("acceptance.acceptPhsRisk", value)}
          error={errors.acceptPhsRisk}
        />
      </div>
    </FormSection>
  )
})

export const HlaSection = memo(function HlaFields({
  value: v,
  errors,
  set,
}: SectionProps<PatientFormValue, "hla">) {
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

export const SerologySection = memo(function SerologyFields({
  value: v,
  errors,
  set,
  serologyDate,
  enrolledHivResearchProtocol,
}: SectionProps<PatientFormValue, "serology"> &
  Pick<PatientFormValue, "serologyDate" | "enrolledHivResearchProtocol">) {
  return (
    <FormSection id="serology" title="Serology">
      <SerologyGrid
        value={v}
        onChange={(value) => set("serology", value)}
        tests={O.RECIPIENT_TESTS}
        errors={errors}
      />
      <DateField
        id="field-serologyDate"
        disableFuture
        label="Serology date"
        value={serologyDate}
        onChange={(value) => set("serologyDate", value)}
        error={errors.serologyDate}
      />
      <SwitchField
        id="field-enrolledHivResearchProtocol"
        label="Enrolled in HIV research protocol (HOPE)"
        value={enrolledHivResearchProtocol}
        onChange={(value) => set("enrolledHivResearchProtocol", value)}
        error={errors.enrolledHivResearchProtocol}
      />
    </FormSection>
  )
})

export const NotesSection = memo(function NotesFields({
  value: v,
  errors,
  set,
}: SectionProps<PatientFormValue, "notes">) {
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
