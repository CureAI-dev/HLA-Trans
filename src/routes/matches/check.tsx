import { useState } from "react"
import { flushSync } from "react-dom"
import {
  Link,
  createFileRoute,
  useBlocker,
  useNavigate,
} from "@tanstack/react-router"
import { z } from "zod"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { criteriaQueries } from "@/features/criteria/criteria.queries"
import { patientQueries } from "@/features/patients/patients.queries"
import { donorQueries } from "@/features/donors/donors.queries"
import { useCheckPair } from "@/features/matches/matches.mutations"
import { SubmitButton } from "@/components/app/submit-button"
import { defaultPairInputs } from "@/domain/factories"
import { evaluate } from "@/domain/engine"
import { pairInputsSchema } from "@/domain/schema"
import { PageHeader } from "@/components/app/page-header"
import { PairPicker } from "@/components/evaluation/pair-picker"
import { PairInputsForm } from "@/components/evaluation/pair-inputs-form"
import { ResultView } from "@/components/evaluation/result-view"

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
  component: CheckAPair,
})
function CheckAPair() {
  const search = Route.useSearch(),
    navigate = useNavigate()
  const check = useCheckPair()
  const [patientId, setPatientId] = useState(search.patientId ?? ""),
    [donorId, setDonorId] = useState(search.donorId ?? "")
  const [pair, setPair] = useState(defaultPairInputs),
    [error, setError] = useState("")
  const [isSaved, setSaved] = useState(false)
  const dirty =
    !isSaved &&
    Boolean(
      patientId ||
      donorId ||
      JSON.stringify(pair) !== JSON.stringify(defaultPairInputs())
    )
  useBlocker({
    shouldBlockFn: () =>
      dirty && !window.confirm("Discard this unsaved pair check?"),
    enableBeforeUnload: dirty,
  })
  const { data: criteria } = useSuspenseQuery(criteriaQueries.latest())
  const patientQuery = useQuery({
    ...patientQueries.detail(patientId),
    enabled: Boolean(patientId),
  })
  const donorQuery = useQuery({
    ...donorQueries.detail(donorId),
    enabled: Boolean(donorId),
  })
  const patient = patientId ? patientQuery.data?.record : undefined,
    donor = donorId ? donorQuery.data?.record : undefined
  const parsedPair = pairInputsSchema.safeParse(pair)
  const pairErrors: Record<string, string> = {}
  if (!parsedPair.success) {
    for (const issue of parsedPair.error.issues) {
      pairErrors[issue.path.join(".")] = issue.message
    }
  }
  const result =
    patient && donor && parsedPair.success
      ? evaluate({
          patient,
          donor,
          pair: parsedPair.data,
          criteria: criteria.criteria,
        })
      : null
  return (
    <div className="space-y-5">
      <PageHeader
        title="Check a pair"
        description="Choose a patient and donor, review the live result, then save it as a match result."
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
        <p role="alert">
          A selected record no longer exists. Choose an available record.
        </p>
      )}
      <PairInputsForm value={pair} onChange={setPair} errors={pairErrors} />
      {!parsedPair.success && (
        <p role="alert">
          Correct the highlighted pair inputs to preview or save this match
          result.
        </p>
      )}
      {result && patient && donor && (
        <ResultView
          result={result}
          patient={patient}
          donor={donor}
          pair={pair}
          criteria={criteria.criteria}
          criteriaVersion={criteria.version}
        />
      )}
      <SubmitButton
        type="button"
        pending={check.isPending}
        disabled={!result}
        onClick={() => {
          setError("")
          if (!parsedPair.success || !result || check.isPending) return
          check.mutate(
            { patientId, donorId, pair: parsedPair.data },
            {
              onSuccess: (saved) => {
                flushSync(() => setSaved(true))
                void navigate({
                  to: "/matches/$matchId",
                  params: { matchId: saved.id },
                })
              },
              onError: (e) =>
                setError(
                  e instanceof Error ? e.message : "Unable to save match result"
                ),
            }
          )
        }}
      >
        Save match result
      </SubmitButton>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
