import { useState } from "react"
import { HLA_LOCI } from "@/domain/schema"
import type { HlaTyping } from "@/domain/schema"
import { normalizeHla } from "@/domain/hla"
import { TextField } from "./text-field"
import { TriField } from "./tri-field"
import { DateField } from "./date-field"
import { resolveHlaError } from "./hla-errors"
import type { HlaLocalError } from "./hla-errors"

export interface HlaTypingGridProps {
  value: HlaTyping
  onChange: (value: HlaTyping) => void
  errors?: Record<string, string>
}
export function HlaTypingGrid({ value, onChange, errors }: HlaTypingGridProps) {
  const [invalid, setInvalid] = useState<Record<string, HlaLocalError>>({})
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {HLA_LOCI.flatMap((locus) =>
          [0, 1].map((index) => {
            const key = `${locus}.${index}`
            return (
              <TextField
                key={key}
                label={`${locus} allele ${index + 1}`}
                className="font-mono"
                value={value[locus][index]}
                error={resolveHlaError(
                  value[locus][index],
                  invalid[key],
                  errors?.[key]
                )}
                onChange={(next) => {
                  const pair: [string, string] = [...value[locus]]
                  pair[index] = next
                  onChange({ ...value, [locus]: pair })
                  setInvalid((previous) => {
                    const remaining = { ...previous }
                    delete remaining[key]
                    return remaining
                  })
                }}
                onBlur={() => {
                  const raw = value[locus][index]
                  if (!raw.trim()) {
                    setInvalid((previous) => {
                      const remaining = { ...previous }
                      delete remaining[key]
                      return remaining
                    })
                    return
                  }
                  const normalized = normalizeHla(raw, locus)
                  if (!normalized) {
                    setInvalid((previous) => ({
                      ...previous,
                      [key]: { raw, message: `Invalid ${locus} typing.` },
                    }))
                    return
                  }
                  setInvalid((previous) => {
                    const remaining = { ...previous }
                    delete remaining[key]
                    return remaining
                  })
                  const pair: [string, string] = [...value[locus]]
                  pair[index] = normalized
                  onChange({ ...value, [locus]: pair })
                }}
              />
            )
          })
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TriField
          label="Bw4"
          value={value.bw4}
          error={errors?.bw4}
          onChange={(bw4) => onChange({ ...value, bw4 })}
        />
        <TriField
          label="Bw6"
          value={value.bw6}
          error={errors?.bw6}
          onChange={(bw6) => onChange({ ...value, bw6 })}
        />
        <DateField
          label="Typing date"
          value={value.typingDate}
          error={errors?.typingDate}
          onChange={(typingDate) => onChange({ ...value, typingDate })}
        />
        <TextField
          label="Typing method"
          value={value.method}
          error={errors?.method}
          onChange={(method) => onChange({ ...value, method })}
        />
      </div>
    </div>
  )
}

