import { normalizeHla } from "@/domain/hla"
import type { Antibody } from "@/domain/schema"

export type Path<T> = T extends object
  ? {
      [K in keyof T & (string | number)]:
        | `${K}`
        | (NonNullable<T[K]> extends object
            ? `${K}.${Path<NonNullable<T[K]>>}`
            : never)
    }[keyof T & (string | number)]
  : never
export type PathValue<
  T,
  TPath extends string,
> = TPath extends `${infer K}.${infer R}`
  ? K extends keyof T
    ? PathValue<T[K], R>
    : T extends ReadonlyArray<infer U>
      ? PathValue<U, R>
      : never
  : TPath extends keyof T
    ? T[TPath]
    : T extends ReadonlyArray<infer U>
      ? U
      : never
export function updateAtPath<T>(value: T, path: string, next: unknown): T {
  const [head, ...tail] = path.split(".")
  const source = value as Record<string, unknown>
  const copy = Array.isArray(value) ? [...value] : { ...source }
  ;(copy as Record<string, unknown>)[head] = tail.length
    ? updateAtPath(source[head], tail.join("."), next)
    : next
  return copy as T
}
export function parseNumberInput(raw: string): number | null | undefined {
  if (!raw.trim()) return null
  return /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(raw.trim()) &&
    Number.isFinite(Number(raw))
    ? Number(raw)
    : undefined
}
export function parseAntibodyPaste(raw: string): {
  rows: Antibody[]
  invalidTokens: string[]
} {
  const rows: Antibody[] = []
  const invalidTokens: string[] = []
  for (const token of raw
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)) {
    const match = /^([A-Za-z][A-Za-z0-9*:]*?)(?:\s+|:\s*)(\d+(?:\.\d+)?)$/.exec(
      token
    )
    if (!match || !normalizeHla(match[1]) || Number(match[2]) > 100000) {
      invalidTokens.push(token)
      continue
    }
    rows.push({
      id: `paste-${rows.length}-${match[1]}-${match[2]}`,
      antigen: match[1].toUpperCase(),
      mfi: Number(match[2]),
      c1q: "not_done",
      testDate: "",
    })
  }
  return { rows, invalidTokens }
}
