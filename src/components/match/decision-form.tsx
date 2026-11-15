import { useState } from "react"
import { flushSync } from "react-dom"
import type { Decision } from "@/domain/schema"
import type { MatchDetail } from "@/domain/match-types"
import { DECISION_VERDICT, DECLINE_REASON } from "@/domain/options"
import { TextField, SelectField } from "@/components/form"
import { UnsavedGuard } from "@/components/form/unsaved-guard"
import { SubmitButton } from "@/components/app/submit-button"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { useDecideMatch } from "@/features/matches/matches.mutations"

/** Recording form for a checked result with no decision yet. */
export function DecisionForm({
  match,
  clinician,
}: {
  match: MatchDetail
  clinician: string
}) {
  const decide = useDecideMatch(match.id)
  const [draft, setDraft] = useState<Omit<Decision, "decidedAt">>({
    verdict: "defer",
    reasons: [],
    clinician,
    rationale: "",
    acknowledgedFindings: false,
  })
  const [error, setError] = useState("")
  const [baseline] = useState(() => JSON.stringify(draft))
  const [saved, setSaved] = useState(false)
  const dirty = !saved && JSON.stringify(draft) !== baseline
  const requiresAck =
    match.result.overall !== "pass" ||
    [
      ...match.result.blockers,
      ...match.result.rules.flatMap((r) => r.findings),
    ].some((f) => f.status === "fail" || f.status === "review")
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        setError("")
        if (!draft.clinician.trim() || !draft.rationale.trim()) {
          setError("Clinician and rationale are required.")
          return
        }
        if (draft.verdict === "decline" && !draft.reasons.length) {
          setError("Select at least one decline reason.")
          return
        }
        if (requiresAck && !draft.acknowledgedFindings) {
          setError("Acknowledge all FAIL and REVIEW findings.")
          return
        }
        if (decide.isPending) return
        decide.mutate(draft, {
          onSuccess: () => flushSync(() => setSaved(true)),
          onError: (e) =>
            setError(e instanceof Error ? e.message : "Unable to save decision"),
        })
      }}
    >
      <UnsavedGuard when={dirty && !decide.isPending} />
      <p className="text-sm text-muted-foreground">
        This decision is final and cannot be edited after saving.
      </p>
      <SelectField
        label="Decision"
        value={draft.verdict}
        options={DECISION_VERDICT}
        onChange={(v) => setDraft({ ...draft, verdict: v })}
      />
      <TextField
        label="Deciding clinician (required)"
        value={draft.clinician}
        onChange={(v) => setDraft({ ...draft, clinician: v })}
      />
      <label className="block text-sm">
        Rationale (required)
        <Textarea
          className="mt-2 min-h-28"
          required
          value={draft.rationale}
          onChange={(e) => setDraft({ ...draft, rationale: e.target.value })}
        />
      </label>
      {draft.verdict === "decline" && (
        <fieldset className="space-y-2 text-sm">
          <legend className="mb-1">Decline reasons (choose at least one)</legend>
          {DECLINE_REASON.map((o) => (
            <label className="flex items-center gap-2" key={o.value}>
              <Checkbox
                checked={draft.reasons.includes(o.value)}
                onCheckedChange={(checked) =>
                  setDraft({
                    ...draft,
                    reasons: checked
                      ? [...draft.reasons, o.value]
                      : draft.reasons.filter((r) => r !== o.value),
                  })
                }
              />
              {o.label}
            </label>
          ))}
        </fieldset>
      )}
      {requiresAck && (
        <label className="flex items-start gap-2 text-sm">
          <Checkbox
            className="mt-0.5"
            checked={draft.acknowledgedFindings}
            onCheckedChange={(checked) =>
              setDraft({ ...draft, acknowledgedFindings: checked })
            }
          />
          I have reviewed all FAIL and REVIEW findings
        </label>
      )}
      {error && (
        <p role="alert" className="text-sm text-fail">
          {error}
        </p>
      )}
      <SubmitButton pending={decide.isPending} className="w-full">
        Save final decision
      </SubmitButton>
    </form>
  )
}
