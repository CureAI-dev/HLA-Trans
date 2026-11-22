import { HLA_LOCI } from "@/domain/schema"
import type { Antibody, Vasoactive } from "@/domain/schema"
import { C1Q, INOTROPE_AGENT, INOTROPE_UNIT, SEROLOGY, TRI, labelOf } from "@/domain/options"
import type { Option } from "@/domain/options"
import { parseIsoDate } from "@/domain/dates"

export type RecordField = {
  path: string
  label: string
  unit?: string
  options?: ReadonlyArray<{ value: string; label: string }>
  format?: "date" | "bool" | "list" | "hla" | "multiline"
}
export type RecordSection = { id: string; title: string; fields: RecordField[] }

/**
 * Dotted paths to displayable leaves. Arrays count as one leaf (rendered by a
 * format); every nested object is walked, so `hla.A` and
 * `infection.serology.hcvNat` are separate leaves that the spec must list.
 */
export function leafPaths(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return prefix ? [prefix] : []
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => leafPaths(v, prefix ? `${prefix}.${k}` : k))
}

export function getAtPath(record: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>((acc, key) => (acc !== null && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined), record)
}

/** HLA typing fields, labelled as in HlaTypingGrid (one row per locus pair). */
export function hlaFields(prefix: string): RecordField[] {
  return [
    ...HLA_LOCI.map((locus): RecordField => ({ path: `${prefix}.${locus}`, label: `${locus} alleles`, format: "hla" })),
    { path: `${prefix}.bw4`, label: "Bw4", options: TRI },
    { path: `${prefix}.bw6`, label: "Bw6", options: TRI },
    { path: `${prefix}.typingDate`, label: "Typing date", format: "date" },
    { path: `${prefix}.method`, label: "Typing method" },
  ]
}

/** Serology results, labelled as in SerologyGrid (test label from the panel). */
export function serologyFields(prefix: string, tests: ReadonlyArray<Option>): RecordField[] {
  return tests.map((t) => ({ path: `${prefix}.${t.value}`, label: t.label, options: SEROLOGY }))
}

/**
 * Not yet answered, for completeness counts: blank, "Unknown", or a serology
 * test still "Not done". Other "Not done" values (e.g. angiography) are real
 * answers. Display still uses isBlank, so "Unknown" is shown as entered.
 */
export function isUnrecorded(path: string, v: unknown): boolean {
  if (isBlank(v) || v === "unknown") return true
  return v === "not_done" && path.includes("serology")
}

/** Blank = nothing entered. `false` and `0` are recorded values, not blanks. */
export function isBlank(v: unknown): boolean {
  if (v === null || v === undefined) return true
  if (typeof v === "string") return v.trim() === ""
  if (Array.isArray(v)) return v.every(isBlank)
  return false
}

const dateFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" })

function formatDate(value: string): string {
  const d = parseIsoDate(value)
  return d === null ? value : dateFmt.format(d)
}

const isRow = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v)

function formatRow(path: string, row: unknown): string {
  if (!isRow(row)) return String(row)
  if (path === "sensitization.antibodies") {
    const a = row as Partial<Antibody>
    const date = a.testDate ? `, ${formatDate(a.testDate)}` : ""
    return `${a.antigen ?? ""} MFI ${a.mfi ?? "?"} (C1q ${labelOf(C1Q, a.c1q).toLowerCase()}${date})`
  }
  if ("agent" in row) {
    const v = row as Partial<Vasoactive>
    if (!v.agent) return ""
    const dose = v.dose === null || v.dose === undefined ? "dose not recorded" : `${v.dose} ${INOTROPE_UNIT[v.agent]}`
    return `${labelOf(INOTROPE_AGENT, v.agent)} ${dose}`
  }
  return Object.entries(row)
    .filter(([k]) => k !== "id")
    .map(([k, v]) => `${k} ${String(v)}`)
    .join(", ")
}

/** Display text for a non-blank value. Rows of objects render one per line. */
export function formatRecordValue(field: RecordField, value: unknown): string {
  if (Array.isArray(value)) {
    const items = value.filter((v) => !isBlank(v))
    if (field.options) return items.map((v) => labelOf(field.options as ReadonlyArray<Option>, String(v))).join("\n")
    if (field.format === "hla") return items.map(String).join(", ")
    if (items.some(isRow)) return items.map((r) => formatRow(field.path, r)).filter(Boolean).join("\n")
    return items.map(String).join(", ")
  }
  if (field.options) return labelOf(field.options as ReadonlyArray<Option>, String(value))
  if (field.format === "bool") return value ? "Yes" : "No"
  if (field.format === "date") return formatDate(String(value))
  return `${String(value)}${field.unit ? ` ${field.unit}` : ""}`
}
