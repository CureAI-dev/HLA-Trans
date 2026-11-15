import { memo, useState } from "react"
import { flushSync } from "react-dom"
import { Link, useNavigate } from "@tanstack/react-router"
import { donorSchema } from "@/domain/schema"
import type { Donor } from "@/domain/schema"
import {
  useCreateDonor,
  useUpdateDonor,
} from "@/features/donors/donors.mutations"
import { isAppError } from "@/lib/app-error"
import { SubmitButton } from "@/components/app/submit-button"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { donorRecordSections } from "@/components/record/donor-record"
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
import { DonorDerived } from "./donor-summary"
import * as S from "./donor-form-sections"

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
const sectionIds = donorSections.map((s) => s.id)
/** Every donor section id equals its top-level key. */
const sectionOf = (key: string) => key.split(".")[0]

/** Derived values read sex, age and body only; memoised on exactly those props. */
const DonorDerivedRail = memo(function DonorDerivedValues({
  sex,
  ageYears,
  body,
}: Pick<Donor["identity"], "sex" | "ageYears"> & Pick<Donor, "body">) {
  // DonorDerived takes a whole Donor but reads only these fields.
  const donor = { identity: { sex, ageYears }, body } as Donor
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold">Derived values</h2>
      <div className="[&_output]:text-sm [&>div]:my-0! [&>div]:grid-cols-2! [&>div>div]:p-2">
        <DonorDerived donor={donor} />
      </div>
    </div>
  )
})

export function DonorForm({
  initial,
  version,
}: {
  initial: Donor
  /** Present when editing: the optimistic-concurrency version the edit started from. */
  version?: number
}) {
  const form = useFormState(initial, donorSchema)
  const p = form.value
  const navigate = useNavigate()
  const create = useCreateDonor()
  const update = useUpdateDonor()
  const saving = create.isPending || update.isPending
  // Captured once: a background refetch must not move the edit's base version (that would hide a conflict).
  const [baseVersion, setBaseVersion] = useState(version)
  const [saveError, setSaveError] = useState("")
  const errors = useSectionErrors(form.errors, sectionIds, sectionOf)
  const completeness = useFormCompleteness(p, donorRecordSections, errors)
  useHashScroll()

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (saving) return
    setSaveError("")
    if (!form.validate()) {
      setSaveError("Please correct the marked fields before saving.")
      return
    }
    try {
      const result =
        baseVersion === undefined
          ? (await create.mutateAsync(p)).donor
          : await update.mutateAsync({ donor: p, expectedVersion: baseVersion })
      setBaseVersion(result.version)
      flushSync(() => form.reset(result.record))
      toast.add({
        title:
          baseVersion === undefined
            ? "Donor saved. Matching started."
            : "Donor saved",
      })
      void navigate({
        to: "/donors/$donorId",
        params: { donorId: result.record.id },
      })
    } catch (error) {
      if (isAppError(error) && error.code === "VALIDATION") {
        form.setErrors((previous) => ({ ...previous, ...error.issues }))
        setSaveError(error.message)
      } else {
        setSaveError(
          error instanceof Error ? error.message : "Unable to save donor."
        )
      }
    }
  }

  const actions = (
    <>
      <SubmitButton pending={saving}>Save donor</SubmitButton>
      <Button
        variant="outline"
        nativeButton={false}
        render={
          version === undefined ? (
            <Link to="/donors" />
          ) : (
            <Link to="/donors/$donorId" params={{ donorId: initial.id }} />
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
        sections={donorRecordSections}
        sectionOf={sectionOf}
      />
      <DonorDerivedRail
        sex={p.identity.sex}
        ageYears={p.identity.ageYears}
        body={p.body}
      />
    </>
  )
  const { set } = form

  return (
    <form onSubmit={(event) => void save(event)} noValidate>
      <UnsavedGuard when={form.dirty && !saving} />
      <FormLayout
        sections={donorSections}
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
        <S.BodySection value={p.body} errors={errors.body} set={set} />
        <S.BloodSection value={p.blood} errors={errors.blood} set={set} />
        <S.DonationSection
          value={p.donation}
          errors={errors.donation}
          set={set}
        />
        <S.DeathSection value={p.death} errors={errors.death} set={set} />
        <S.HistorySection value={p.history} errors={errors.history} set={set} />
        <S.HemodynamicsSection
          value={p.hemodynamics}
          errors={errors.hemodynamics}
          set={set}
        />
        <S.EchoSection value={p.echo} errors={errors.echo} set={set} />
        <S.CoronarySection
          value={p.coronary}
          errors={errors.coronary}
          set={set}
        />
        <S.EcgSection value={p.ecg} errors={errors.ecg} set={set} />
        <S.LabsSection value={p.labs} errors={errors.labs} set={set} />
        <S.InfectionSection
          value={p.infection}
          errors={errors.infection}
          set={set}
        />
        <S.HlaSection value={p.hla} errors={errors.hla} set={set} />
        <S.NotesSection value={p.notes} errors={errors.notes} set={set} />
      </FormLayout>
    </form>
  )
}
