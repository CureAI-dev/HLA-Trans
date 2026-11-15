import { useDeferredValue, useMemo, useState } from "react"
import { flushSync } from "react-dom"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { z } from "zod"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { criteriaQueries } from "@/features/criteria/criteria.queries"
import { patientQueries } from "@/features/patients/patients.queries"
import { donorQueries } from "@/features/donors/donors.queries"
import { useCheckPair } from "@/features/matches/matches.mutations"
import { SubmitButton } from "@/components/app/submit-button"
import { FormPageSkeleton } from "@/components/app/page-skeletons"
import { UnsavedGuard } from "@/components/form/unsaved-guard"
import { defaultPairInputs } from "@/domain/factories"
import { evaluate } from "@/domain/engine"
import { pairInputsSchema } from "@/domain/schema"
import type { PairInputs } from "@/domain/schema"
import { PageHeader } from "@/components/app/page-header"
import { PairPicker } from "@/components/match/pair-picker"
import { PairInputsForm } from "@/components/match/pair-inputs-form"
import { ResultView } from "@/components/match/result-view"

const searchSchema = z.object({
  patientId: z.string().optional().catch(undefined),
  donorId: z.string().optional().catch(undefined),
})
export const Route = createFileRoute("/matches/check")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps }) => {
    const qc = context.queryClient
    // Prefetch (never throws): a stale id shows an inline message, not an error page.
    await Promise.all([
      qc.ensureQueryData(criteriaQueries.latest()),
      deps.patientId && qc.prefetchQuery(patientQueries.detail(deps.patientId)),
      deps.donorId && qc.prefetchQuery(donorQueries.detail(deps.donorId)),
    ])
  },
  head: () => ({ meta: [{ title: "Check a pair · HLA-Trans" }] }),
  pendingComponent: FormPageSkeleton,
  component: CheckAPair,
})

const DEFAULT_PAIR = JSON.stringify(defaultPairInputs())

function pairErrorsOf(pair: PairInputs) {
  const parsed = pairInputsSchema.safeParse(pair)
  const errors: Record<string, string> = {}
  if (!parsed.success)
    for (const issue of parsed.error.issues)
      errors[issue.path.join(".")] = issue.message
  return { parsed, errors }
}

function CheckAPair() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const check = useCheckPair()
  const [patientId, setPatientId] = useState(search.patientId ?? "")
  const [donorId, setDonorId] = useState(search.donorId ?? "")
  const [pair, setPair] = useState(defaultPairInputs)
  const [error, setError] = useState("")
  const [isSaved, setSaved] = useState(false)
  const dirty =
    !isSaved &&
    Boolean(patientId || donorId || JSON.stringify(pair) !== DEFAULT_PAIR)
  const { data: criteria } = useSuspenseQuery(criteriaQueries.latest())
  const patientQuery = useQuery({
    ...patientQueries.detail(patientId),
    enabled: Boolean(patientId),
  })
  const donorQuery = useQuery({
    ...donorQueries.detail(donorId),
    enabled: Boolean(donorId),
  })
  const patient = patientId ? patientQuery.data?.record : undefined
  const donor = donorId ? donorQuery.data?.record : undefined

  // Field errors follow every keystroke (cheap); the preview runs the engine
  // on a deferred copy so typing never waits on it.
  const { parsed, errors: pairErrors } = pairErrorsOf(pair)
  const deferredPair = useDeferredValue(pair)
  const preview = useMemo(() => {
    if (!patient || !donor) return null
    const p = pairInputsSchema.safeParse(deferredPair)
    if (!p.success) return null
    return {
      pair: p.data,
      result: evaluate({
        patient,
        donor,
        pair: p.data,
        criteria: criteria.criteria,
      }),
    }
  }, [patient, donor, deferredPair, criteria.criteria])
  const stale = deferredPair !== pair

  const save = async () => {
    setError("")
    if (!parsed.success || !patient || !donor || check.isPending) return
    try {
      const saved = await check.mutateAsync({
        patientId,
        donorId,
        pair: parsed.data,
      })
      flushSync(() => setSaved(true))
      void navigate({ to: "/matches/$matchId", params: { matchId: saved.id } })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save match result")
    }
  }

  return (
    <div className="space-y-5">
      <UnsavedGuard when={dirty && !check.isPending} />
      <PageHeader
        title="Check a pair"
        description="Choose a patient and donor, enter the pair inputs, review the live result, then save it as a match result."
      />
      <PairPicker
        patient={patient ?? null}
        donor={donor ?? null}
        patientId={patientId}
        donorId={donorId}
        onPatientChange={setPatientId}
        onDonorChange={setDonorId}
      />
      <p className="text-sm text-muted-foreground">
        No records yet? Add{" "}
        <Link className="underline" to="/patients/new">
          a patient
        </Link>{" "}
        and{" "}
        <Link className="underline" to="/donors/new">
          a donor
        </Link>{" "}
        first.
      </p>
      {(patientQuery.isError || donorQuery.isError) && (
        <p role="alert" className="text-sm text-fail">
          A selected record no longer exists. Choose an available record.
        </p>
      )}
      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <PairInputsForm value={pair} onChange={setPair} errors={pairErrors} />
          {!parsed.success && (
            <p role="alert" className="text-sm text-fail">
              Correct the highlighted pair inputs to preview or save this match
              result.
            </p>
          )}
          <SubmitButton
            type="button"
            className="w-full"
            pending={check.isPending}
            disabled={!parsed.success || !patient || !donor}
            onClick={() => void save()}
          >
            Save match result
          </SubmitButton>
          {error && (
            <p role="alert" className="text-sm text-fail">
              {error}
            </p>
          )}
        </div>
        <div
          className="min-w-0 transition-opacity"
          style={{ opacity: stale ? 0.7 : 1 }}
          aria-busy={stale}
        >
          {preview && patient && donor ? (
            <ResultView
              key={`${patientId}:${donorId}`}
              detail={{
                result: preview.result,
                patient,
                donor,
                pair: preview.pair,
                criteria: criteria.criteria,
                criteriaVersion: criteria.version,
              }}
              mode="preview"
              onPairFix={() => {
                const el = document.getElementById("pair-inputs")
                el?.scrollIntoView({ behavior: "smooth", block: "start" })
                el?.querySelector<HTMLElement>("input, button, select")?.focus({
                  preventScroll: true,
                })
              }}
            />
          ) : (
            <p className="border border-dashed p-8 text-center text-sm text-muted-foreground">
              {!patient || !donor
                ? "Choose a patient and a donor to see the live result."
                : "Correct the pair inputs to see the live result."}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
