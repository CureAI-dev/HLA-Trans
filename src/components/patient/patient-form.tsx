import { z } from "zod"
import { memo, useState } from "react"
import { flushSync } from "react-dom"
import { Link, useNavigate } from "@tanstack/react-router"
import { patientSchema } from "@/domain/schema"
import type { Patient } from "@/domain/schema"
import {
  useCreatePatient,
  useUpdatePatient,
} from "@/features/patients/patients.mutations"
import { isAppError } from "@/lib/app-error"
import { SubmitButton } from "@/components/app/submit-button"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { patientRecordSections } from "@/components/record/patient-record"
import {
  CompletenessMeter,
  FormLayout,
  UnsavedGuard,
  ValidationSummary,
  useFormCompleteness,
  useFormState,
  useHashScroll,
  useSectionErrors,
} from "@/components/form"
import { PatientDerived, PatientHemodynamics } from "./patient-summary"
import * as S from "./patient-form-sections"
import type { PatientFormValue } from "./patient-form-sections"

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
const sectionIds = patientSections.map((s) => s.id)

/** Top-level fields that live in a section named differently from their key. */
const SECTION_OVERRIDES: Record<string, string> = {
  serologyDate: "serology",
  enrolledHivResearchProtocol: "serology",
  unacceptableAntigensText: "sensitization",
}
const sectionOf = (key: string) => {
  const head = key.split(".")[0]
  return SECTION_OVERRIDES[head] ?? head
}

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

const toFormValue = (patient: Patient): PatientFormValue => ({
  ...patient,
  unacceptableAntigensText:
    patient.sensitization.unacceptableAntigens.join(", "),
})

/**
 * Derived values read sex, date of birth, body and hemodynamics only. Memoised
 * on exactly those props so typing an MRN, a lab or a note does not touch them.
 */
const PatientDerivedRail = memo(function PatientDerivedValues({
  sex,
  dateOfBirth,
  body,
  hemodynamics,
}: Pick<Patient["identity"], "sex" | "dateOfBirth"> &
  Pick<Patient, "body" | "hemodynamics">) {
  // The summary components take a whole Patient but read only these fields.
  const patient = {
    identity: { sex, dateOfBirth },
    body,
    hemodynamics,
  } as Patient
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold">Derived values</h2>
      <div className="[&_output]:text-sm [&>div]:grid-cols-2! [&>div>div]:p-2">
        <PatientDerived patient={patient} />
      </div>
      <div className="[&_output]:text-sm [&>div]:grid-cols-2! [&>div>div]:p-2">
        <PatientHemodynamics patient={patient} />
      </div>
    </div>
  )
})

export function PatientForm({
  initial,
  version,
}: {
  initial: Patient
  /** Present when editing: the optimistic-concurrency version the edit started from. */
  version?: number
}) {
  const form = useFormState(toFormValue(initial), patientFormSchema)
  const p = form.value
  const navigate = useNavigate()
  const create = useCreatePatient()
  const update = useUpdatePatient()
  const saving = create.isPending || update.isPending
  // Captured once: a background refetch must not move the edit's base version (that would hide a conflict).
  const [baseVersion, setBaseVersion] = useState(version)
  const [saveError, setSaveError] = useState("")
  const errors = useSectionErrors(form.errors, sectionIds, sectionOf)
  const completeness = useFormCompleteness(p, patientRecordSections, errors)
  useHashScroll()

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (saving) return
    setSaveError("")
    if (!form.validate()) {
      setSaveError("Please correct the marked fields before saving.")
      return
    }
    const { unacceptableAntigensText, ...rest } = p
    const candidate: Patient = {
      ...rest,
      sensitization: {
        ...rest.sensitization,
        unacceptableAntigens: unacceptableAntigensText
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      },
    }
    try {
      const result =
        baseVersion === undefined
          ? (await create.mutateAsync(candidate)).patient
          : await update.mutateAsync({
              patient: candidate,
              expectedVersion: baseVersion,
            })
      setBaseVersion(result.version)
      flushSync(() => form.reset(toFormValue(result.record)))
      toast.add({
        title:
          baseVersion === undefined
            ? "Patient saved. Matching started."
            : "Patient saved",
      })
      void navigate({
        to: "/patients/$patientId",
        params: { patientId: result.record.id },
      })
    } catch (error) {
      if (isAppError(error) && error.code === "VALIDATION") {
        form.setErrors((previous) => ({ ...previous, ...error.issues }))
        setSaveError(error.message)
      } else {
        setSaveError(
          error instanceof Error ? error.message : "Unable to save patient."
        )
      }
    }
  }

  const actions = (
    <>
      <SubmitButton pending={saving}>Save patient</SubmitButton>
      <Button
        variant="outline"
        nativeButton={false}
        render={
          version === undefined ? (
            <Link to="/patients" />
          ) : (
            <Link
              to="/patients/$patientId"
              params={{ patientId: initial.id }}
            />
          )
        }
      >
        Cancel
      </Button>
      <span className="text-sm text-muted-foreground" aria-live="polite">
        {form.dirty ? "Unsaved changes" : "No unsaved changes"}
      </span>
    </>
  )
  const rail = (
    <>
      <CompletenessMeter
        recorded={completeness.recorded}
        total={completeness.total}
      />
      <ValidationSummary
        errors={form.errors}
        sections={patientRecordSections}
        sectionOf={sectionOf}
      />
      <PatientDerivedRail
        sex={p.identity.sex}
        dateOfBirth={p.identity.dateOfBirth}
        body={p.body}
        hemodynamics={p.hemodynamics}
      />
    </>
  )
  const { set } = form

  return (
    <form onSubmit={(event) => void save(event)} noValidate>
      <UnsavedGuard when={form.dirty && !saving} />
      <FormLayout
        sections={patientSections}
        status={completeness.status}
        rail={rail}
        actions={actions}
      >
        {saveError && (
          <p role="alert" className="border border-destructive/50 p-3">
            {saveError}
          </p>
        )}
        <S.IdentitySection
          value={p.identity}
          errors={errors.identity}
          set={set}
        />
        <S.ListingSection value={p.listing} errors={errors.listing} set={set} />
        <S.BodySection value={p.body} errors={errors.body} set={set} />
        <S.BloodSection value={p.blood} errors={errors.blood} set={set} />
        <S.DiagnosisSection
          value={p.diagnosis}
          errors={errors.diagnosis}
          set={set}
        />
        <S.HemodynamicsSection
          value={p.hemodynamics}
          errors={errors.hemodynamics}
          set={set}
        />
        <S.SupportSection value={p.support} errors={errors.support} set={set} />
        <S.FunctionSection
          value={p.function}
          errors={errors.function}
          set={set}
        />
        <S.LabsSection value={p.labs} errors={errors.labs} set={set} />
        <S.HistorySection value={p.history} errors={errors.history} set={set} />
        <S.SensitizationSection
          value={p.sensitization}
          unacceptableAntigensText={p.unacceptableAntigensText}
          errors={errors.sensitization}
          set={set}
        />
        <S.AcceptanceSection
          value={p.acceptance}
          errors={errors.acceptance}
          set={set}
        />
        <S.HlaSection value={p.hla} errors={errors.hla} set={set} />
        <S.SerologySection
          value={p.serology}
          serologyDate={p.serologyDate}
          enrolledHivResearchProtocol={p.enrolledHivResearchProtocol}
          errors={errors.serology}
          set={set}
        />
        <S.NotesSection value={p.notes} errors={errors.notes} set={set} />
      </FormLayout>
    </form>
  )
}
