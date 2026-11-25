import { useState } from "react"
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
import { ScrollArea } from "@/components/ui/scroll-area"
import { SubmitButton } from "@/components/app/submit-button"
import { UnsavedGuard } from "@/components/form/unsaved-guard"
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
  publish: (criteria: Criteria, note: string) => Promise<CriteriaVersion>
}) {
  const [draft, setDraft] = useState<Draft>(() =>
    structuredClone(current.criteria)
  )
  const [source, setSource] = useState(current)
  const [note, setNote] = useState("")
  const [attempted, setAttempted] = useState(false)
  const [pending, setPending] = useState<Criteria | null>(null)
  const [message, setMessage] = useState("")
  const [failure, setFailure] = useState("")
  const [section, setSection] = useState<string>("abo")
  const [publishing, setPublishing] = useState(false)
  const dirty =
    JSON.stringify(draft) !== JSON.stringify(source.criteria) || note.length > 0
  // While our own publish settles, the new latest version arrives before `source` catches up.
  const conflict = !publishing && current.id !== source.id
  if (conflict && !dirty) {
    setSource(current)
    setDraft(structuredClone(current.criteria))
    setPending(null)
    setAttempted(false)
  }
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
    if (conflict) {
      setFailure("Reload the latest criteria before reviewing a publication.")
      return
    }
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
  async function confirm() {
    const toPublish = pending
    if (!toPublish || publishing) return
    if (conflict) {
      setFailure(
        "Criteria changed in another tab. Reload the latest criteria before publishing."
      )
      setPending(null)
      return
    }
    setPublishing(true)
    setPending(null)
    try {
      const saved = await publish(toPublish, note.trim())
      setDraft(structuredClone(saved.criteria))
      setSource(saved)
      setNote("")
      setAttempted(false)
      setMessage(`Published criteria version ${saved.version}.`)
    } catch (error) {
      setFailure(
        error instanceof Error ? error.message : "Unable to publish criteria."
      )
    } finally {
      setPublishing(false)
    }
  }
  return (
    <>
      <UnsavedGuard when={dirty && !publishing} />
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          review()
        }}
        className="space-y-5"
      >
        <h2 className="text-xl font-semibold">
          Edit from version {source.version}
        </h2>
        {conflict && (
          <div role="alert" className="space-y-3 border p-4">
            <p>
              Version {current.version} is now available. Your unsaved draft
              still uses version {source.version}. Reload the latest criteria to
              discard this draft before publishing.
            </p>
            <Button
              type="button"
              onClick={() => {
                setSource(current)
                setDraft(structuredClone(current.criteria))
                setNote("")
                setPending(null)
                setAttempted(false)
                setFailure("")
                setMessage("")
              }}
            >
              Discard draft and reload latest criteria
            </Button>
          </div>
        )}
        <Tabs
          value={section}
          onValueChange={(value) => setSection(String(value))}
        >
          <TabsList
            aria-label="Criteria sections"
            data-guide="criteria-tabs"
            className="h-auto! max-w-full flex-wrap justify-start"
          >
            {CRITERIA_SECTIONS.map((item) => (
              <TabsTrigger
                key={item.id}
                value={item.id}
                data-guide={`criteria-tab-${item.id}`}
              >
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
              <div
                data-guide="criteria-fields"
                className="grid gap-5 md:grid-cols-2"
              >
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
        <div data-guide="criteria-change-note">
          <TextField
            label="Change note (required)"
            value={note}
            onChange={setNote}
            error={
              attempted && !note.trim() ? "Enter a change note." : undefined
            }
          />
        </div>
        {attempted && Object.keys(errors).length > 0 && (
          <p role="alert">
            Correct the highlighted criteria before publishing.
          </p>
        )}
        {failure && <p role="alert">{failure}</p>}
        {message && <p role="status">{message}</p>}
        <SubmitButton
          pending={publishing}
          pendingLabel="Publishing…"
          data-guide="criteria-publish"
        >
          Review and publish
        </SubmitButton>
      </form>
      <AlertDialog
        open={pending !== null && !conflict}
        onOpenChange={(open) => {
          if (!open) setPending(null)
        }}
      >
        <AlertDialogContent className="max-h-[85vh] grid-rows-[auto_auto_minmax(0,1fr)_auto] sm:max-w-2xl!">
          <AlertDialogTitle>
            Publish criteria version {current.version + 1}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Review each change before publishing. Changing criteria does not
            change past match results.
          </AlertDialogDescription>
          <ScrollArea
            viewportProps={{ className: "data-has-overflow-y:pr-3.5" }}
            contentClassName="space-y-4"
          >
            {pending && (
              <CriteriaDiff before={current.criteria} after={pending} />
            )}
            <p className="text-sm whitespace-pre-wrap">
              Change note: {note.trim()}
            </p>
          </ScrollArea>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirm()}>
              Confirm publication
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
