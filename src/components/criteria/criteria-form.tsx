import { useState } from "react"
import { useBlocker } from "@tanstack/react-router"
import {
  CRITERIA_FIELDS,
  CRITERIA_SECTIONS,
  OUTCOME_LABEL,
  validateCriteria,
} from "@/domain/criteria"
import { criteriaSchema } from "@/domain/schema"
import type { Criteria, CriteriaVersion, Outcome } from "@/domain/schema"
import {
  NumberField,
  SelectField,
  SwitchField,
  TextField,
} from "@/components/form"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog"
import { CriteriaDiff, criteriaChanges } from "./criteria-diff"

type Draft = Record<
  keyof Criteria,
  Record<string, number | string | boolean | null>
>
export function CriteriaForm({
  current,
  publish,
}: {
  current: CriteriaVersion
  publish: (criteria: Criteria, note: string) => CriteriaVersion
}) {
  const [draft, setDraft] = useState<Draft>(() =>
    structuredClone(current.criteria)
  )
  const [baseline, setBaseline] = useState(() =>
    JSON.stringify(current.criteria)
  )
  const [note, setNote] = useState("")
  const [attempted, setAttempted] = useState(false)
  const [pending, setPending] = useState<Criteria | null>(null)
  const [message, setMessage] = useState("")
  const [failure, setFailure] = useState("")
  const [section, setSection] = useState<string>("abo")
  const dirty = JSON.stringify(draft) !== baseline || note.length > 0
  useBlocker({
    shouldBlockFn: () =>
      dirty && !window.confirm("Discard unsaved criteria changes?"),
    enableBeforeUnload: dirty,
  })
  const parsed = criteriaSchema.safeParse(draft)
  const errors: Record<string, string> = {}
  if (!parsed.success)
    for (const issue of parsed.error.issues)
      errors[issue.path.join(".")] = issue.message
  else
    for (const issue of validateCriteria(parsed.data))
      errors[issue.path] = issue.message
  const update = (
    group: keyof Criteria,
    key: string,
    value: number | string | boolean | null
  ) => {
    setDraft((previous) => ({
      ...previous,
      [group]: { ...previous[group], [key]: value },
    }))
    setMessage("")
  }
  function review() {
    setAttempted(true)
    setFailure("")
    if (Object.keys(errors).length) {
      setSection(Object.keys(errors)[0].split(".")[0])
      return
    }
    if (!note.trim() || !parsed.success) return
    if (!criteriaChanges(current.criteria, parsed.data).length) {
      setFailure("Change at least one criteria field before publishing.")
      return
    }
    setPending(parsed.data)
  }
  function confirm() {
    if (!pending) return
    try {
      const saved = publish(pending, note.trim())
      setDraft(structuredClone(saved.criteria))
      setBaseline(JSON.stringify(saved.criteria))
      setNote("")
      setPending(null)
      setAttempted(false)
      setMessage(`Published criteria version ${saved.version}.`)
    } catch (error) {
      setFailure(
        error instanceof Error ? error.message : "Unable to publish criteria."
      )
      setPending(null)
    }
  }
  return (
    <>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          review()
        }}
        className="space-y-5"
      >
        <h2 className="text-xl font-semibold">
          Edit from version {current.version}
        </h2>
        <Tabs
          value={section}
          onValueChange={(value) => setSection(String(value))}
        >
          <TabsList
            aria-label="Criteria sections"
            className="h-auto! max-w-full flex-wrap justify-start"
          >
            {CRITERIA_SECTIONS.map((item) => (
              <TabsTrigger key={item.id} value={item.id}>
                {item.title}
                {attempted &&
                Object.keys(errors).some((path) =>
                  path.startsWith(`${item.id}.`)
                )
                  ? " | errors"
                  : ""}
              </TabsTrigger>
            ))}
          </TabsList>
          {CRITERIA_SECTIONS.map((item) => (
            <TabsContent key={item.id} value={item.id}>
              <p className="my-4 text-sm text-muted-foreground">
                {item.description}
              </p>
              <div className="grid gap-5 md:grid-cols-2">
                {CRITERIA_FIELDS.filter(
                  (field) => field.section === item.id
                ).map((field) => {
                  const path = `${field.section}.${field.key}`,
                    value = draft[field.section][field.key]
                  const common = {
                    label: field.label,
                    error: attempted ? errors[path] : undefined,
                    hint: field.source,
                  }
                  return (
                    <div key={path}>
                      {field.kind === "number" ? (
                        <NumberField
                          {...common}
                          unit={
                            field.unit ??
                            (field.key.includes("Ratio") ? "ratio" : "count")
                          }
                          step={field.step}
                          value={typeof value === "number" ? value : null}
                          onChange={(next) =>
                            update(field.section, field.key, next)
                          }
                        />
                      ) : field.kind === "boolean" ? (
                        <SwitchField
                          {...common}
                          value={value === true}
                          onChange={(next) =>
                            update(field.section, field.key, next)
                          }
                        />
                      ) : (
                        <SelectField<Outcome>
                          {...common}
                          value={value as Outcome}
                          options={(["pass", "review", "fail"] as const).map(
                            (outcome) => ({
                              value: outcome,
                              label: OUTCOME_LABEL[outcome],
                            })
                          )}
                          onChange={(next) =>
                            update(field.section, field.key, next)
                          }
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </TabsContent>
          ))}
        </Tabs>
        <TextField
          label="Change note (required)"
          value={note}
          onChange={setNote}
          error={attempted && !note.trim() ? "Enter a change note." : undefined}
        />
        {attempted && Object.keys(errors).length > 0 && (
          <p role="alert">
            Correct the highlighted criteria before publishing.
          </p>
        )}
        {failure && <p role="alert">{failure}</p>}
        {message && <p role="status">{message}</p>}
        <Button type="submit">Review and publish</Button>
      </form>
      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null)
        }}
      >
        <AlertDialogContent className="max-h-[85vh] overflow-auto sm:max-w-2xl!">
          <AlertDialogTitle>
            Publish criteria version {current.version + 1}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Review each change before publishing. Changing criteria does not
            change past evaluations.
          </AlertDialogDescription>
          {pending && (
            <CriteriaDiff before={current.criteria} after={pending} />
          )}
          <p className="text-sm whitespace-pre-wrap">
            Change note: {note.trim()}
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirm}>
              Confirm publication
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
