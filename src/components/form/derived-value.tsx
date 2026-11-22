import type { ReactNode } from "react"
import { Check, Info, X } from "lucide-react"
import type { DerivedHelp, HelpInput } from "./derived-help"
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface DerivedValueProps {
  label: string
  value: ReactNode
  unit: string
  hint?: string
  help?: DerivedHelp
  /** Inputs become jump links to their form fields (forms only). */
  linkFields?: boolean
}

function jumpTo(field: string) {
  const el = document.getElementById(field)
  if (!el) return
  el.scrollIntoView({ block: "center" })
  el.focus({ preventScroll: true })
}

function InputName({ input, link }: { input: HelpInput; link: boolean }) {
  if (!link) return <>{input.label}</>
  return (
    <button
      type="button"
      className="cursor-pointer underline underline-offset-2 hover:text-foreground"
      onClick={() => jumpTo(input.field)}
    >
      {input.label}
    </button>
  )
}

export function DerivedValue({
  label,
  value,
  unit,
  hint,
  help,
  linkFields = false,
}: DerivedValueProps) {
  const missing = help?.inputs.filter((input) => input.value === null) ?? []
  const empty = value == null
  return (
    <div className="border p-3">
      <div className="flex items-start justify-between gap-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        {help && (
          <Popover>
            <PopoverTrigger
              aria-label={`How ${label} is calculated`}
              className="-m-1 shrink-0 cursor-pointer p-1 text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring data-popup-open:text-primary"
            >
              <Info className="size-3.5" aria-hidden="true" />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80">
              <PopoverTitle>{label}</PopoverTitle>
              <dl className="grid grid-cols-[4.5rem_1fr] gap-x-3 gap-y-2">
                <dt className="text-muted-foreground">Formula</dt>
                <dd className="font-mono">{help.formula}</dd>
                <dt className="text-muted-foreground">Inputs</dt>
                <dd>
                  <ul className="space-y-0.5">
                    {help.inputs.map((input) => (
                      <li
                        key={input.field + input.label}
                        className="flex gap-1.5"
                      >
                        {input.value === null ? (
                          <X
                            className="mt-0.5 size-3 shrink-0"
                            aria-label="Not recorded"
                          />
                        ) : (
                          <Check
                            className="mt-0.5 size-3 shrink-0"
                            aria-label="Recorded"
                          />
                        )}
                        <span>
                          <InputName input={input} link={linkFields} />
                          {input.value !== null && (
                            <span className="text-muted-foreground tabular-nums">
                              {" "}
                              {input.value}
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </dd>
                <dt className="text-muted-foreground">Used for</dt>
                <dd>{help.usedFor}</dd>
              </dl>
            </PopoverContent>
          </Popover>
        )}
      </div>
      <output className="tabular-nums">
        {empty && help ? "–" : `${value ?? "Not recorded"} ${unit}`}
      </output>
      {empty && help ? (
        <p className="text-xs text-muted-foreground">
          {help.needs ? (
            `Needs: ${help.needs}`
          ) : missing.length ? (
            <>
              Needs:{" "}
              {missing.map((input, i) => (
                <span key={input.field + input.label}>
                  {i > 0 && ", "}
                  <InputName input={input} link={linkFields} />
                </span>
              ))}
            </>
          ) : (
            "Can't be calculated from the recorded values."
          )}
        </p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}
