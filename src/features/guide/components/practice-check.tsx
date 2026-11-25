import { useDeferredValue, useMemo, useState } from "react"
import { evaluate } from "@/domain/engine"
import { defaultPairInputs } from "@/domain/factories"
import { pairInputsSchema } from "@/domain/schema"
import type { PairInputs } from "@/domain/schema"
import { PageHeader } from "@/components/app/page-header"
import { PairInputsForm } from "@/components/match/pair-inputs-form"
import { donorLabel, patientLabel } from "@/components/match/pair-picker"
import { ResultView } from "@/components/match/result-view"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PRACTICE_CRITERIA, PRACTICE_VALUES, practicePair } from "../practice"
import { PracticeBanner } from "./practice-banner"

/** Check a pair with demo records: the real engine and the real result, without saving. */
export default function PracticeCheck({ filled }: { filled: boolean }) {
  const [{ patient, donor }] = useState(practicePair)
  // `filled` matters only when a tutorial is resumed here; later changes keep what was typed.
  const [pair, setPair] = useState<PairInputs>(() => ({
    ...defaultPairInputs(),
    ...(filled && PRACTICE_VALUES),
  }))
  const deferred = useDeferredValue(pair)
  const errors: Record<string, string> = {}
  const parsed = pairInputsSchema.safeParse(pair)
  if (!parsed.success)
    for (const issue of parsed.error.issues)
      errors[issue.path.join(".")] = issue.message
  const preview = useMemo(() => {
    const p = pairInputsSchema.safeParse(deferred)
    return p.success
      ? {
          pair: p.data,
          result: evaluate({
            patient,
            donor,
            pair: p.data,
            criteria: PRACTICE_CRITERIA.criteria,
          }),
        }
      : null
  }, [patient, donor, deferred])
  return (
    <div className="space-y-5">
      <div>
        <PracticeBanner />
        <PageHeader
          title="Check a pair"
          description="Choose a patient and donor, enter the pair inputs, review the live result, then save it as a match result."
        />
      </div>
      <section
        data-guide="pair-picker"
        className="grid gap-4 border p-4 md:grid-cols-2"
      >
        <label className="space-y-2">
          <span className="block">Patient</span>
          <Input readOnly value={patientLabel(patient)} />
        </label>
        <label className="space-y-2">
          <span className="block">Donor</span>
          <Input readOnly value={donorLabel(donor)} />
        </label>
      </section>
      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <PairInputsForm value={pair} onChange={setPair} errors={errors} />
          <Button className="w-full" disabled data-guide="pair-save">
            Practice: saving is off
          </Button>
        </div>
        <div className="min-w-0">
          {preview ? (
            <ResultView
              detail={{
                ...preview,
                patient,
                donor,
                criteria: PRACTICE_CRITERIA.criteria,
                criteriaVersion: PRACTICE_CRITERIA.version,
              }}
              mode="preview"
              onPairFix={() =>
                document
                  .getElementById("pair-inputs")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
            />
          ) : (
            <p className="border border-dashed p-8 text-center text-sm text-muted-foreground">
              Correct the pair inputs to see the live result.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
