import { useState } from "react"
import { flushSync } from "react-dom"
import { useBlocker } from "@tanstack/react-router"
import type { Decision } from "@/domain/schema"
import type { MatchDetail } from "@/domain/match-types"
import { DECISION_VERDICT, DECLINE_REASON } from "@/domain/options"
import { TextField, SelectField } from "@/components/form"
import { SubmitButton } from "@/components/app/submit-button"
import { useDecideMatch } from "@/features/matches/matches.mutations"

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
  const dirty =
    !match.decision && !saved && JSON.stringify(draft) !== baseline
  useBlocker({
    shouldBlockFn: () =>
      dirty && !window.confirm("Discard unsaved decision changes?"),
    enableBeforeUnload: dirty,
  })
  const requiresAck =
    match.result.overall !== "pass" ||
    [
      ...match.result.blockers,
      ...match.result.rules.flatMap((r) => r.findings),
    ].some((f) => f.status === "fail" || f.status === "review")
  if (match.decision) {
    const d = match.decision
    return (
      <section className="space-y-3 border p-4">
        <h2 className="text-lg font-semibold">Final decision / read-only</h2>
        <p>{DECISION_VERDICT.find((o) => o.value === d.verdict)?.label}</p>
        <p>
          Clinician: {d.clinician} /{" "}
          <time dateTime={d.decidedAt} suppressHydrationWarning>
            {new Date(d.decidedAt).toLocaleString()}
          </time>
        </p>
        <p>Rationale: {d.rationale}</p>
        <p>
          Reasons:{" "}
          {d.reasons
            .map((r) => DECLINE_REASON.find((o) => o.value === r)?.label ?? r)
            .join(", ") || "None"}
        </p>
        <p>
          FAIL / REVIEW findings acknowledged:{" "}
          {d.acknowledgedFindings ? "Yes" : "Not required"}
        </p>
      </section>
    )
  }
  return (
    <form
      className="space-y-4 border p-4"
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
      <h2 className="text-lg font-semibold">Record clinician decision</h2>
      <p>This decision is final and cannot be edited after saving.</p>
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
      <label className="block">
        Rationale (required)
        <textarea
          className="mt-2 block min-h-28 w-full border p-2"
          required
          value={draft.rationale}
          onChange={(e) => setDraft({ ...draft, rationale: e.target.value })}
        />
      </label>
      {draft.verdict === "decline" && (
        <fieldset className="space-y-2">
          <legend>Decline reasons (choose at least one)</legend>
          {DECLINE_REASON.map((o) => (
            <label className="flex items-center gap-2" key={o.value}>
              <input
                type="checkbox"
                checked={draft.reasons.includes(o.value)}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    reasons: e.target.checked
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
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={draft.acknowledgedFindings}
            onChange={(e) =>
              setDraft({ ...draft, acknowledgedFindings: e.target.checked })
            }
          />
          I have reviewed all FAIL and REVIEW findings
        </label>
      )}
      {error && (
        <p role="alert" className="text-fail">
          {error}
        </p>
      )}
      <SubmitButton pending={decide.isPending}>Save final decision</SubmitButton>
    </form>
  )
}
