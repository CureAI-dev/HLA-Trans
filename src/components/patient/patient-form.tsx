import { z } from "zod"
import { useState } from "react"
import { flushSync } from "react-dom"
import { Link, useNavigate } from "@tanstack/react-router"
import * as O from "@/domain/options"
import { patientSchema } from "@/domain/schema"
import type { Patient } from "@/domain/schema"
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
  AntibodyTable,
  VasoactiveList,
  SerologyGrid,
  useFormState,
} from "@/components/form"
import { PatientDerived, PatientHemodynamics } from "./patient-summary"

export const patientSections = [
  { id: "identity", title: "Identity" },
  { id: "listing", title: "Listing" },
  { id: "body", title: "Body" },
  { id: "blood", title: "Blood type" },
  { id: "diagnosis", title: "Diagnosis" },
  { id: "hemodynamics", title: "Hemodynamics" },
  { id: "support", title: "Support" },
  { id: "function", title: "Function" },
  { id: "labs", title: "Labs" },
  { id: "history", title: "History" },
  { id: "sensitization", title: "Sensitization" },
  { id: "acceptance", title: "Acceptance" },
  { id: "hla", title: "HLA typing" },
  { id: "serology", title: "Serology" },
  { id: "notes", title: "Notes" },
]
const patientFormSchema = patientSchema
  .extend({
    unacceptableAntigensText: z.string(),
  })
  .superRefine((patient, context) => {
    for (const key of ["mrn", "firstName", "lastName"] as const) {
      if (!patient.identity[key].trim())
        context.addIssue({
          code: "custom",
          path: ["identity", key],
          message: "This required identity field cannot be blank.",
        })
    }
  })

export function PatientForm({ initial }: { initial: Patient }) {
  const form = useFormState(
    {
      ...initial,
      unacceptableAntigensText:
        initial.sensitization.unacceptableAntigens.join(", "),
    },
    patientFormSchema
  )
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
      const candidate = {
        ...p,
        sensitization: {
          ...p.sensitization,
          unacceptableAntigens: p.unacceptableAntigensText
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
        },
      }
      const saved = actions.savePatient(candidate)
      flushSync(() =>
        form.reset({
          ...saved,
          unacceptableAntigensText:
            saved.sensitization.unacceptableAntigens.join(", "),
        })
      )
      toast.add({ title: "Patient saved" })
      void navigate({
        to: "/patients/$patientId",
        params: { patientId: saved.id },
      })
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Unable to save patient."
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
        <FormSideNav sections={patientSections} />
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
              label="Medical record number *"
              value={p.identity.mrn}
              onChange={(value) => form.set("identity.mrn", value)}
              error={form.errors["identity.mrn"]}
            />
            <TextField
              label="First name *"
              value={p.identity.firstName}
              onChange={(value) => form.set("identity.firstName", value)}
              error={form.errors["identity.firstName"]}
            />
            <TextField
              label="Last name *"
              value={p.identity.lastName}
              onChange={(value) => form.set("identity.lastName", value)}
              error={form.errors["identity.lastName"]}
            />
            <DateField
              label="Date of birth *"
              value={p.identity.dateOfBirth}
              onChange={(value) => form.set("identity.dateOfBirth", value)}
              error={form.errors["identity.dateOfBirth"]}
            />
            <SelectField
              label="Sex *"
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
            <TextField
              label="Transplant center"
              value={p.identity.transplantCenter}
              onChange={(value) => form.set("identity.transplantCenter", value)}
              error={form.errors["identity.transplantCenter"]}
            />
            <TextField
              label="Attending physician"
              value={p.identity.attendingPhysician}
              onChange={(value) =>
                form.set("identity.attendingPhysician", value)
              }
              error={form.errors["identity.attendingPhysician"]}
            />
          </div>
        </FormSection>
        <FormSection id="listing" title="Listing">
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              label="State"
              value={p.listing.state}
              onChange={(value) => form.set("listing.state", value)}
              error={form.errors["listing.state"]}
              options={O.CANDIDATE_STATE}
            />
            <DateField
              label="Listing date"
              value={p.listing.listingDate}
              onChange={(value) => form.set("listing.listingDate", value)}
              error={form.errors["listing.listingDate"]}
            />
            <SelectField
              label="Urgency status"
              value={p.listing.urgencyStatus ?? ""}
              onChange={(value) =>
                form.set("listing.urgencyStatus", value === "" ? null : value)
              }
              options={[
                { value: "", label: "Not recorded" },
                ...O.URGENCY_STATUS,
              ]}
              error={form.errors["listing.urgencyStatus"]}
            />
            <TextField
              label="Status criterion"
              value={p.listing.statusCriterion}
              onChange={(value) => form.set("listing.statusCriterion", value)}
              error={form.errors["listing.statusCriterion"]}
            />
            <DateField
              label="Status date"
              value={p.listing.statusDate}
              onChange={(value) => form.set("listing.statusDate", value)}
              error={form.errors["listing.statusDate"]}
            />
            <DateField
              label="Status expires on"
              value={p.listing.statusExpiresOn}
              onChange={(value) => form.set("listing.statusExpiresOn", value)}
              error={form.errors["listing.statusExpiresOn"]}
            />
            <SwitchField
              label="Multi-organ candidate"
              value={p.listing.multiOrgan}
              onChange={(value) => form.set("listing.multiOrgan", value)}
              error={form.errors["listing.multiOrgan"]}
            />
            <TextField
              label="Other organs"
              value={p.listing.otherOrgans}
              onChange={(value) => form.set("listing.otherOrgans", value)}
              error={form.errors["listing.otherOrgans"]}
            />
          </div>
        </FormSection>
        <FormSection id="body" title="Body">
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
            <PatientDerived patient={p} />
          </div>
        </FormSection>
        <FormSection id="blood" title="Blood type">
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              label="ABO blood group"
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
            <SwitchField
              label="Accept intended ABO-incompatible pediatric offers"
              value={p.blood.acceptsIncompatible}
              onChange={(value) => form.set("blood.acceptsIncompatible", value)}
              error={form.errors["blood.acceptsIncompatible"]}
            />
            <NumberField
              label="Anti-A titer denominator (1:x)"
              value={p.blood.antiATiter}
              onChange={(value) => form.set("blood.antiATiter", value)}
              error={form.errors["blood.antiATiter"]}
              unit="denominator"
            />
            <NumberField
              label="Anti-B titer denominator (1:x)"
              value={p.blood.antiBTiter}
              onChange={(value) => form.set("blood.antiBTiter", value)}
              error={form.errors["blood.antiBTiter"]}
              unit="denominator"
            />
            <DateField
              label="Titer date"
              value={p.blood.titerDate}
              onChange={(value) => form.set("blood.titerDate", value)}
              error={form.errors["blood.titerDate"]}
            />
            <SwitchField
              label="Titer-lowering therapy within 30 days"
              value={p.blood.titerLoweringTherapyWithin30Days}
              onChange={(value) =>
                form.set("blood.titerLoweringTherapyWithin30Days", value)
              }
              error={form.errors["blood.titerLoweringTherapyWithin30Days"]}
            />
          </div>
        </FormSection>
        <FormSection id="diagnosis" title="Diagnosis">
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              label="Primary heart diagnosis"
              value={p.diagnosis.primary ?? ""}
              onChange={(value) =>
                form.set("diagnosis.primary", value === "" ? null : value)
              }
              options={[
                { value: "", label: "Not recorded" },
                ...O.HEART_DIAGNOSIS,
              ]}
              error={form.errors["diagnosis.primary"]}
            />
            <TextField
              label="Detail"
              value={p.diagnosis.detail}
              onChange={(value) => form.set("diagnosis.detail", value)}
              error={form.errors["diagnosis.detail"]}
            />
            <DateField
              label="Diagnosis date"
              value={p.diagnosis.diagnosisDate}
              onChange={(value) => form.set("diagnosis.diagnosisDate", value)}
              error={form.errors["diagnosis.diagnosisDate"]}
            />
          </div>
        </FormSection>
        <FormSection id="hemodynamics" title="Hemodynamics">
          <div className="grid gap-4 md:grid-cols-2">
            <DateField
              label="Catheterization date"
              value={p.hemodynamics.catheterizationDate}
              onChange={(value) =>
                form.set("hemodynamics.catheterizationDate", value)
              }
              error={form.errors["hemodynamics.catheterizationDate"]}
            />
            <NumberField
              label="PA systolic pressure"
              value={p.hemodynamics.paSystolic}
              onChange={(value) => form.set("hemodynamics.paSystolic", value)}
              error={form.errors["hemodynamics.paSystolic"]}
              unit="mmHg"
            />
            <NumberField
              label="PA diastolic pressure"
              value={p.hemodynamics.paDiastolic}
              onChange={(value) => form.set("hemodynamics.paDiastolic", value)}
              error={form.errors["hemodynamics.paDiastolic"]}
              unit="mmHg"
            />
            <NumberField
              label="PA mean pressure (measured)"
              value={p.hemodynamics.paMean}
              onChange={(value) => form.set("hemodynamics.paMean", value)}
              error={form.errors["hemodynamics.paMean"]}
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
              label="Right atrial pressure"
              value={p.hemodynamics.rap}
              onChange={(value) => form.set("hemodynamics.rap", value)}
              error={form.errors["hemodynamics.rap"]}
              unit="mmHg"
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
              label="Cardiac index"
              value={p.hemodynamics.cardiacIndex}
              onChange={(value) => form.set("hemodynamics.cardiacIndex", value)}
              error={form.errors["hemodynamics.cardiacIndex"]}
              unit="L/min/m^2"
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
              label="Mixed venous oxygen saturation"
              value={p.hemodynamics.mixedVenousSat}
              onChange={(value) =>
                form.set("hemodynamics.mixedVenousSat", value)
              }
              error={form.errors["hemodynamics.mixedVenousSat"]}
              unit="%"
            />
            <SwitchField
              label="On inotropes during cath"
              value={p.hemodynamics.onInotropesDuringCath}
              onChange={(value) =>
                form.set("hemodynamics.onInotropesDuringCath", value)
              }
              error={form.errors["hemodynamics.onInotropesDuringCath"]}
            />
            <SwitchField
              label="Vasodilator challenge done"
              value={p.hemodynamics.vasodilatorChallengeDone}
              onChange={(value) =>
                form.set("hemodynamics.vasodilatorChallengeDone", value)
              }
              error={form.errors["hemodynamics.vasodilatorChallengeDone"]}
            />
            <NumberField
              label="PVR after vasodilator challenge"
              value={p.hemodynamics.pvrAfterChallenge}
              onChange={(value) =>
                form.set("hemodynamics.pvrAfterChallenge", value)
              }
              error={form.errors["hemodynamics.pvrAfterChallenge"]}
              unit="WU"
            />
            <PatientHemodynamics patient={p} />
          </div>
        </FormSection>
        <FormSection id="support" title="Support">
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              label="Device"
              value={p.support.device}
              onChange={(value) => form.set("support.device", value)}
              error={form.errors["support.device"]}
              options={O.MCS_DEVICE}
            />
            <TextField
              label="Device brand"
              value={p.support.deviceBrand}
              onChange={(value) => form.set("support.deviceBrand", value)}
              error={form.errors["support.deviceBrand"]}
            />
            <DateField
              label="Device implant date"
              value={p.support.deviceImplantDate}
              onChange={(value) => form.set("support.deviceImplantDate", value)}
              error={form.errors["support.deviceImplantDate"]}
            />
            <VasoactiveList
              value={p.support.inotropes}
              onChange={(value) => form.set("support.inotropes", value)}
              errors={subErrors("support.inotropes")}
            />
            <SwitchField
              label="Mechanical ventilation"
              value={p.support.mechanicalVentilation}
              onChange={(value) =>
                form.set("support.mechanicalVentilation", value)
              }
              error={form.errors["support.mechanicalVentilation"]}
            />
            <SwitchField
              label="Inhaled nitric oxide"
              value={p.support.inhaledNitricOxide}
              onChange={(value) =>
                form.set("support.inhaledNitricOxide", value)
              }
              error={form.errors["support.inhaledNitricOxide"]}
            />
            <SwitchField
              label="Implantable cardioverter defibrillator"
              value={p.support.icd}
              onChange={(value) => form.set("support.icd", value)}
              error={form.errors["support.icd"]}
            />
          </div>
        </FormSection>
        <FormSection id="function" title="Function">
          <div className="grid gap-4 md:grid-cols-2">
            <NumberField
              label="Left ventricular ejection fraction"
              value={p.function.lvef}
              onChange={(value) => form.set("function.lvef", value)}
              error={form.errors["function.lvef"]}
              unit="%"
            />
            <SelectField
              label="NYHA functional class"
              value={p.function.nyha ?? ""}
              onChange={(value) =>
                form.set("function.nyha", value === "" ? null : value)
              }
              options={[{ value: "", label: "Not recorded" }, ...O.NYHA]}
              error={form.errors["function.nyha"]}
            />
            <NumberField
              label="Peak VO2"
              value={p.function.peakVo2}
              onChange={(value) => form.set("function.peakVo2", value)}
              error={form.errors["function.peakVo2"]}
              unit="mL/kg/min"
            />
            <SwitchField
              label="On beta blocker"
              value={p.function.onBetaBlocker}
              onChange={(value) => form.set("function.onBetaBlocker", value)}
              error={form.errors["function.onBetaBlocker"]}
            />
            <SwitchField
              label="Hospitalized"
              value={p.function.hospitalized}
              onChange={(value) => form.set("function.hospitalized", value)}
              error={form.errors["function.hospitalized"]}
            />
            <SwitchField
              label="In intensive care"
              value={p.function.inIcu}
              onChange={(value) => form.set("function.inIcu", value)}
              error={form.errors["function.inIcu"]}
            />
          </div>
        </FormSection>
        <FormSection id="labs" title="Labs">
          <div className="grid gap-4 md:grid-cols-2">
            <DateField
              label="Lab date"
              value={p.labs.labDate}
              onChange={(value) => form.set("labs.labDate", value)}
              error={form.errors["labs.labDate"]}
            />
            <NumberField
              label="Creatinine"
              value={p.labs.creatinine}
              onChange={(value) => form.set("labs.creatinine", value)}
              error={form.errors["labs.creatinine"]}
              unit="mg/dL"
            />
            <NumberField
              label="Estimated GFR"
              value={p.labs.egfr}
              onChange={(value) => form.set("labs.egfr", value)}
              error={form.errors["labs.egfr"]}
              unit="mL/min/1.73 m^2"
            />
            <SelectField
              label="Dialysis"
              value={p.labs.dialysis}
              onChange={(value) => form.set("labs.dialysis", value)}
              error={form.errors["labs.dialysis"]}
              options={O.DIALYSIS}
            />
            <NumberField
              label="Bilirubin"
              value={p.labs.bilirubin}
              onChange={(value) => form.set("labs.bilirubin", value)}
              error={form.errors["labs.bilirubin"]}
              unit="mg/dL"
            />
            <NumberField
              label="Albumin"
              value={p.labs.albumin}
              onChange={(value) => form.set("labs.albumin", value)}
              error={form.errors["labs.albumin"]}
              unit="g/dL"
            />
            <NumberField
              label="INR"
              value={p.labs.inr}
              onChange={(value) => form.set("labs.inr", value)}
              error={form.errors["labs.inr"]}
              unit="ratio"
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
              label="Sodium"
              value={p.labs.sodium}
              onChange={(value) => form.set("labs.sodium", value)}
              error={form.errors["labs.sodium"]}
              unit="mmol/L"
            />
            <NumberField
              label="BNP"
              value={p.labs.bnp}
              onChange={(value) => form.set("labs.bnp", value)}
              error={form.errors["labs.bnp"]}
              unit="pg/mL"
            />
            <NumberField
              label="NT-proBNP"
              value={p.labs.ntProBnp}
              onChange={(value) => form.set("labs.ntProBnp", value)}
              error={form.errors["labs.ntProBnp"]}
              unit="pg/mL"
            />
            <NumberField
              label="HbA1c"
              value={p.labs.hba1c}
              onChange={(value) => form.set("labs.hba1c", value)}
              error={form.errors["labs.hba1c"]}
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
              label="Lactate"
              value={p.labs.lactate}
              onChange={(value) => form.set("labs.lactate", value)}
              error={form.errors["labs.lactate"]}
              unit="mmol/L"
            />
          </div>
        </FormSection>
        <FormSection id="history" title="History">
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              label="Diabetes"
              value={p.history.diabetes}
              onChange={(value) => form.set("history.diabetes", value)}
              error={form.errors["history.diabetes"]}
              options={O.DIABETES}
            />
            <SwitchField
              label="Diabetes end organ damage"
              value={p.history.diabetesEndOrganDamage}
              onChange={(value) =>
                form.set("history.diabetesEndOrganDamage", value)
              }
              error={form.errors["history.diabetesEndOrganDamage"]}
            />
            <NumberField
              label="Prior sternotomies"
              value={p.history.priorSternotomies}
              onChange={(value) => form.set("history.priorSternotomies", value)}
              error={form.errors["history.priorSternotomies"]}
              unit="count"
            />
            <TextField
              label="Prior cardiac surgery details"
              value={p.history.priorCardiacSurgery}
              onChange={(value) =>
                form.set("history.priorCardiacSurgery", value)
              }
              error={form.errors["history.priorCardiacSurgery"]}
            />
            <TriField
              label="Malignancy history"
              value={p.history.malignancyHistory}
              onChange={(value) => form.set("history.malignancyHistory", value)}
              error={form.errors["history.malignancyHistory"]}
            />
            <TextField
              label="Malignancy detail"
              value={p.history.malignancyDetail}
              onChange={(value) => form.set("history.malignancyDetail", value)}
              error={form.errors["history.malignancyDetail"]}
            />
            <TriField
              label="Cerebrovascular disease"
              value={p.history.cerebrovascularDisease}
              onChange={(value) =>
                form.set("history.cerebrovascularDisease", value)
              }
              error={form.errors["history.cerebrovascularDisease"]}
            />
            <TriField
              label="Peripheral vascular disease"
              value={p.history.peripheralVascularDisease}
              onChange={(value) =>
                form.set("history.peripheralVascularDisease", value)
              }
              error={form.errors["history.peripheralVascularDisease"]}
            />
            <SelectField
              label="Smoking"
              value={p.history.smoking}
              onChange={(value) => form.set("history.smoking", value)}
              error={form.errors["history.smoking"]}
              options={O.SMOKING}
            />
            <DateField
              label="Smoking quit date"
              value={p.history.smokingQuitDate}
              onChange={(value) => form.set("history.smokingQuitDate", value)}
              error={form.errors["history.smokingQuitDate"]}
            />
            <TriField
              label="Substance use"
              value={p.history.substanceUse}
              onChange={(value) => form.set("history.substanceUse", value)}
              error={form.errors["history.substanceUse"]}
            />
            <TriField
              label="Frailty"
              value={p.history.frailty}
              onChange={(value) => form.set("history.frailty", value)}
              error={form.errors["history.frailty"]}
            />
            <TextField
              label="Psychosocial concerns"
              value={p.history.psychosocialConcerns}
              onChange={(value) =>
                form.set("history.psychosocialConcerns", value)
              }
              error={form.errors["history.psychosocialConcerns"]}
            />
          </div>
        </FormSection>
        <FormSection id="sensitization" title="Sensitization">
          <div className="grid gap-4 md:grid-cols-2">
            <NumberField
              label="Current cPRA (reported by lab)"
              value={p.sensitization.cpra}
              onChange={(value) => form.set("sensitization.cpra", value)}
              error={form.errors["sensitization.cpra"]}
              unit="%"
            />
            <NumberField
              label="Peak cPRA"
              value={p.sensitization.cpraPeak}
              onChange={(value) => form.set("sensitization.cpraPeak", value)}
              error={form.errors["sensitization.cpraPeak"]}
              unit="%"
            />
            <DateField
              label="cPRA test date"
              value={p.sensitization.cpraDate}
              onChange={(value) => form.set("sensitization.cpraDate", value)}
              error={form.errors["sensitization.cpraDate"]}
            />
            <NumberField
              label="Pregnancies"
              value={p.sensitization.pregnancies}
              onChange={(value) => form.set("sensitization.pregnancies", value)}
              error={form.errors["sensitization.pregnancies"]}
              unit="count"
            />
            <SelectField
              label="Transfusions"
              value={p.sensitization.transfusions}
              onChange={(value) =>
                form.set("sensitization.transfusions", value)
              }
              error={form.errors["sensitization.transfusions"]}
              options={O.TRANSFUSION_BAND}
            />
            <NumberField
              label="Prior transplants"
              value={p.sensitization.priorTransplants}
              onChange={(value) =>
                form.set("sensitization.priorTransplants", value)
              }
              error={form.errors["sensitization.priorTransplants"]}
              unit="count"
            />
            <SwitchField
              label="Prior homograft"
              value={p.sensitization.priorHomograft}
              onChange={(value) =>
                form.set("sensitization.priorHomograft", value)
              }
              error={form.errors["sensitization.priorHomograft"]}
            />
            <TextField
              label="Desensitization notes"
              value={p.sensitization.desensitization}
              onChange={(value) =>
                form.set("sensitization.desensitization", value)
              }
              error={form.errors["sensitization.desensitization"]}
            />
            <AntibodyTable
              value={p.sensitization.antibodies}
              onChange={(value) => form.set("sensitization.antibodies", value)}
              errors={subErrors("sensitization.antibodies")}
            />
            <TextField
              label="Unacceptable antigens (comma separated)"
              value={p.unacceptableAntigensText}
              onChange={(value) => {
                form.set("unacceptableAntigensText", value)
                form.set(
                  "sensitization.unacceptableAntigens",
                  value
                    .split(",")
                    .map((token) => token.trim())
                    .filter(Boolean)
                )
              }}
              error={
                form.errors["sensitization.unacceptableAntigens"] ||
                Object.values(
                  subErrors("sensitization.unacceptableAntigens")
                ).join("; ") ||
                undefined
              }
            />
          </div>
        </FormSection>
        <FormSection id="acceptance" title="Acceptance">
          <div className="grid gap-4 md:grid-cols-2">
            <NumberField
              label="Maximum donor age"
              value={p.acceptance.maxDonorAge}
              onChange={(value) => form.set("acceptance.maxDonorAge", value)}
              error={form.errors["acceptance.maxDonorAge"]}
              unit="years"
            />
            <NumberField
              label="Minimum donor weight"
              value={p.acceptance.minDonorWeightKg}
              onChange={(value) =>
                form.set("acceptance.minDonorWeightKg", value)
              }
              error={form.errors["acceptance.minDonorWeightKg"]}
              unit="kg"
            />
            <NumberField
              label="Maximum donor weight"
              value={p.acceptance.maxDonorWeightKg}
              onChange={(value) =>
                form.set("acceptance.maxDonorWeightKg", value)
              }
              error={form.errors["acceptance.maxDonorWeightKg"]}
              unit="kg"
            />
            <NumberField
              label="Maximum donor distance"
              value={p.acceptance.maxDistanceNm}
              onChange={(value) => form.set("acceptance.maxDistanceNm", value)}
              error={form.errors["acceptance.maxDistanceNm"]}
              unit="NM"
            />
            <SwitchField
              label="Accept donation after circulatory death (DCD)"
              value={p.acceptance.acceptDcd}
              onChange={(value) => form.set("acceptance.acceptDcd", value)}
              error={form.errors["acceptance.acceptDcd"]}
            />
            <SwitchField
              label="Accept HCV NAT positive"
              value={p.acceptance.acceptHcvNat}
              onChange={(value) => form.set("acceptance.acceptHcvNat", value)}
              error={form.errors["acceptance.acceptHcvNat"]}
            />
            <SwitchField
              label="Accept HCV antibody positive"
              value={p.acceptance.acceptHcvAb}
              onChange={(value) => form.set("acceptance.acceptHcvAb", value)}
              error={form.errors["acceptance.acceptHcvAb"]}
            />
            <SwitchField
              label="Accept anti-HBc positive"
              value={p.acceptance.acceptAntiHbc}
              onChange={(value) => form.set("acceptance.acceptAntiHbc", value)}
              error={form.errors["acceptance.acceptAntiHbc"]}
            />
            <SwitchField
              label="Accept HBV NAT positive"
              value={p.acceptance.acceptHbvNat}
              onChange={(value) => form.set("acceptance.acceptHbvNat", value)}
              error={form.errors["acceptance.acceptHbvNat"]}
            />
            <SwitchField
              label="Accept PHS risk criteria"
              value={p.acceptance.acceptPhsRisk}
              onChange={(value) => form.set("acceptance.acceptPhsRisk", value)}
              error={form.errors["acceptance.acceptPhsRisk"]}
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
        <FormSection id="serology" title="Serology">
          <SerologyGrid
            value={p.serology}
            onChange={(value) => form.set("serology", value)}
            tests={O.RECIPIENT_TESTS}
            errors={subErrors("serology")}
          />
          <DateField
            label="Serology date"
            value={p.serologyDate}
            onChange={(value) => form.set("serologyDate", value)}
            error={form.errors.serologyDate}
          />
          <SwitchField
            label="Enrolled in HIV research protocol (HOPE)"
            value={p.enrolledHivResearchProtocol}
            onChange={(value) => form.set("enrolledHivResearchProtocol", value)}
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
        <div className="sticky bottom-0 flex gap-3 border bg-background p-4">
          <Button type="submit">Save patient</Button>
          <Link to="/patients" className="px-3 py-2 underline">
            Cancel
          </Link>
          <span className="py-2 text-sm text-muted-foreground">
            {form.dirty ? "Unsaved changes" : "All changes saved"}
          </span>
        </div>
      </div>
    </form>
  )
}
