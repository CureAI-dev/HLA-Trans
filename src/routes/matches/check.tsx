import { useState } from "react"
import { flushSync } from "react-dom"
import {
  Link,
  createFileRoute,
  useBlocker,
  useNavigate,
} from "@tanstack/react-router"
import { z } from "zod"
import { actions, latestCriteria, useDb } from "@/lib/storage/db"
import { defaultPairInputs } from "@/domain/factories"
import { evaluate } from "@/domain/engine"
import { pairInputsSchema } from "@/domain/schema"
import { PageHeader } from "@/components/app/page-header"
import { PairPicker } from "@/components/evaluation/pair-picker"
import { PairInputsForm } from "@/components/evaluation/pair-inputs-form"
import { ResultView } from "@/components/evaluation/result-view"
import { Button } from "@/components/ui/button"

const searchSchema = z.object({
  patientId: z.string().optional().catch(undefined),
  donorId: z.string().optional().catch(undefined),
})
export const Route = createFileRoute("/matches/check")({
  validateSearch: searchSchema,
  component: CheckAPair,
})
function CheckAPair() {
  const search = Route.useSearch(),
    db = useDb(),
    navigate = useNavigate()
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
  const patient = db.patients.find((p) => p.id === patientId),
    donor = db.donors.find((d) => d.id === donorId),
    criteria = latestCriteria(db)
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
        patients={db.patients}
        donors={db.donors}
        patientId={patientId}
        donorId={donorId}
        onPatientChange={setPatientId}
        onDonorChange={setDonorId}
      />
      {(!db.patients.length || !db.donors.length) && (
        <p>
          Add{" "}
          <Link className="underline" to="/patients/new">
            a patient
          </Link>{" "}
          and{" "}
          <Link className="underline" to="/donors/new">
            a donor
          </Link>{" "}
          before checking a pair.
        </p>
      )}
      {((patientId && !patient) || (donorId && !donor)) && (
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
      <Button
        disabled={!result}
        onClick={() => {
          setError("")
          if (!parsedPair.success || !result) return
          try {
            const saved = actions.createEvaluation(
              patientId,
              donorId,
              parsedPair.data
            )
            flushSync(() => setSaved(true))
            void navigate({
              to: "/matches/$matchId",
              params: { matchId: saved.id },
            })
          } catch (e) {
            setError(
              e instanceof Error ? e.message : "Unable to save match result"
            )
          }
        }}
      >
        Save match result
      </Button>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
