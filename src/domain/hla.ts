/**
 * HLA parsing, serologic equivalence and virtual crossmatch.
 *
 * Equivalence follows WHO broad/split relationships, with OPTN Policy 4.11
 * unacceptable-antigen overrides where they differ:
 *   - B15 includes B70, B71, B72
 *   - A10 includes A43
 *   - B*40:05 (B4005) is equivalent to B50 / B21
 *
 * Resolution matters: a donor typed only to a broad (e.g. "B15") cannot
 * exclude an antibody to one of its splits (e.g. "B62"). That case is
 * reported as "possible", never as "no match".
 */

import type { HlaLocus, HlaTyping } from "./schema"

export type SerologicFamily = "A" | "B" | "C" | "DR" | "DR5x" | "DQ"
export type AlleleOnlyLocus = "DQA1" | "DPA1" | "DPB1"

export type HlaSpec =
  | {
      kind: "serologic"
      family: SerologicFamily
      /** Canonical name, e.g. "A24", "Cw9", "DR15", "DR52". */
      antigen: string
      /** True when this antigen is a broad with known splits. */
      isBroad: boolean
    }
  | {
      kind: "allele"
      /** Gene, e.g. "A", "B", "C", "DRB1", "DRB4", "DQB1", "DQA1", "DPB1". */
      gene: string
      /** First field, e.g. "02". */
      group: string
      /** Second field, e.g. "01". Null for one-field typing ("A*02"). */
      protein: string | null
      /** Canonical text, e.g. "A*02:01". */
      name: string
      /** Expression suffix (N = null allele, not expressed). */
      suffix: string | null
      /** Serologic equivalent if known, e.g. "A2". */
      serologic: string | null
      family: SerologicFamily | AlleleOnlyLocus
    }
  | { kind: "bw"; antigen: "Bw4" | "Bw6" }

export type ParseResult = { ok: true; spec: HlaSpec } | { ok: false; error: string }

/* ------------------------------------------------------------------ */
/* Equivalence tables                                                  */
/* ------------------------------------------------------------------ */

/** Broad → splits (WHO 2026 + OPTN overrides). */
const BROADS: Record<string, ReadonlyArray<string>> = {
  A9: ["A23", "A24"],
  A10: ["A25", "A26", "A34", "A66", "A43"],
  A19: ["A29", "A30", "A31", "A32", "A33", "A74"],
  A28: ["A68", "A69"],
  B5: ["B51", "B52"],
  B12: ["B44", "B45"],
  B14: ["B64", "B65"],
  B15: ["B62", "B63", "B75", "B76", "B77", "B70"],
  B16: ["B38", "B39"],
  B17: ["B57", "B58"],
  B21: ["B49", "B50"],
  B22: ["B54", "B55", "B56"],
  B40: ["B60", "B61"],
  B70: ["B71", "B72"],
  Cw3: ["Cw9", "Cw10"],
  DR2: ["DR15", "DR16"],
  DR3: ["DR17", "DR18"],
  DR5: ["DR11", "DR12"],
  DR6: ["DR13", "DR14"],
  DQ1: ["DQ5", "DQ6"],
  DQ3: ["DQ7", "DQ8", "DQ9"],
}

/** Associated antigens → parent split. */
const ASSOCIATED: Record<string, string> = {
  A203: "A2",
  A210: "A2",
  A2403: "A24",
  B703: "B7",
  B2708: "B27",
  B3901: "B39",
  B3902: "B39",
  B4005: "B50",
  B5102: "B51",
  B5103: "B51",
  DR1403: "DR14",
  DR1404: "DR14",
}

/** Serologic antigens with no broad/split relationship (WHO). */
const STANDALONE = new Set([
  "A1", "A2", "A3", "A11", "A36", "A80",
  "B7", "B8", "B13", "B18", "B27", "B35", "B37", "B41", "B42", "B46", "B47",
  "B48", "B53", "B59", "B67", "B73", "B78", "B81", "B82",
  "Cw1", "Cw2", "Cw4", "Cw5", "Cw6", "Cw7", "Cw8", "Cw12", "Cw14", "Cw15",
  "Cw16", "Cw17", "Cw18",
  "DR1", "DR103", "DR4", "DR7", "DR8", "DR9", "DR10",
  "DR51", "DR52", "DR53",
  "DQ2", "DQ4",
])

const PARENT = new Map<string, string>()
for (const [broad, splits] of Object.entries(BROADS)) {
  for (const split of splits) PARENT.set(split, broad)
}
for (const [assoc, parent] of Object.entries(ASSOCIATED)) PARENT.set(assoc, parent)

const KNOWN_SEROLOGIC = new Set<string>([
  ...STANDALONE,
  ...Object.keys(BROADS),
  ...Object.values(BROADS).flat(),
  ...Object.keys(ASSOCIATED),
])

/** All ancestors (split → broad → broad-of-broad), excluding the antigen. */
export function ancestorsOf(antigen: string): Array<string> {
  const out: Array<string> = []
  let current = PARENT.get(antigen)
  while (current && !out.includes(current)) {
    out.push(current)
    current = PARENT.get(current)
  }
  return out
}

/** Antigen plus all ancestors. */
export function withAncestors(antigen: string): Array<string> {
  return [antigen, ...ancestorsOf(antigen)]
}

export function isBroad(antigen: string): boolean {
  return antigen in BROADS
}

export function splitsOf(antigen: string): ReadonlyArray<string> {
  return BROADS[antigen] ?? []
}

/* ------------------------- Bw4 / Bw6 (WHO) ----------------------- */

const BW4_B = new Set([
  "B5", "B5102", "B5103", "B13", "B17", "B27", "B37", "B38", "B44", "B47",
  "B49", "B51", "B52", "B53", "B57", "B58", "B59", "B63", "B77",
])
const BW6_B = new Set([
  "B7", "B703", "B8", "B14", "B18", "B22", "B2708", "B35", "B39", "B3901",
  "B3902", "B40", "B4005", "B41", "B42", "B45", "B46", "B48", "B50", "B54",
  "B55", "B56", "B60", "B61", "B62", "B64", "B65", "B67", "B70", "B71", "B72",
  "B73", "B75", "B76", "B78", "B81", "B82",
])

/* ---------------------- Allele → serologic ----------------------- */

const pad2 = (s: string) => s.padStart(2, "0")

/** Two-field mappings where the first field alone is ambiguous. */
const TWO_FIELD: Record<string, string> = {
  // B*15 (OPTN Table 4-5 equivalences)
  "B*15:01": "B62", "B*15:04": "B62", "B*15:06": "B62", "B*15:07": "B62",
  "B*15:20": "B62", "B*15:25": "B62", "B*15:27": "B62", "B*15:28": "B62",
  "B*15:30": "B62", "B*15:32": "B62", "B*15:35": "B62", "B*15:39": "B62",
  "B*15:16": "B63", "B*15:17": "B63",
  "B*15:02": "B75", "B*15:11": "B75", "B*15:21": "B75",
  "B*15:12": "B76", "B*15:14": "B76",
  "B*15:13": "B77",
  "B*15:10": "B71", "B*15:18": "B71",
  "B*15:03": "B72",
  // B*14, B*40
  "B*14:01": "B64", "B*14:02": "B65",
  "B*40:01": "B60",
  "B*40:02": "B61", "B*40:03": "B61", "B*40:04": "B61", "B*40:06": "B61",
  "B*40:05": "B4005",
  // C*03
  "C*03:03": "Cw9",
  "C*03:02": "Cw10", "C*03:04": "Cw10", "C*03:06": "Cw10",
  // DRB1*03, *01:03, *14 associated
  "DRB1*03:01": "DR17", "DRB1*03:02": "DR18", "DRB1*03:03": "DR18",
  "DRB1*01:03": "DR103",
  "DRB1*14:03": "DR1403", "DRB1*14:04": "DR1404",
  // DQB1*03
  "DQB1*03:01": "DQ7", "DQB1*03:04": "DQ7", "DQB1*03:19": "DQ7",
  "DQB1*03:02": "DQ8", "DQB1*03:05": "DQ8", "DQB1*03:10": "DQ8",
  "DQB1*03:03": "DQ9",
  // Associated antigens
  "A*02:03": "A203", "A*02:10": "A210", "A*24:03": "A2403",
  "B*07:03": "B703", "B*27:08": "B2708",
  "B*39:01": "B3901", "B*39:02": "B3902",
  "B*51:02": "B5102", "B*51:03": "B5103",
}

/** First-field groups that map to a broad only (split needs field 2). */
const FIRST_FIELD_BROAD: Record<string, string> = {
  "B*15": "B15",
  "B*14": "B14",
  "B*40": "B40",
  "C*03": "Cw3",
  "DRB1*03": "DR3",
  "DQB1*03": "DQ3",
}

function firstFieldSerologic(gene: string, group: string): string | null {
  const n = String(Number(group))
  let candidate: string | null = null
  switch (gene) {
    case "A":
      candidate = `A${n}`
      break
    case "B":
      candidate = `B${n}`
      break
    case "C":
      candidate = `Cw${n}`
      break
    case "DRB1":
      candidate = `DR${n}`
      break
    case "DRB3":
      return "DR52"
    case "DRB4":
      return "DR53"
    case "DRB5":
      return "DR51"
    case "DQB1":
      candidate = `DQ${n}`
      break
    default:
      return null
  }
  return candidate && KNOWN_SEROLOGIC.has(candidate) ? candidate : null
}

export function alleleToSerologic(gene: string, group: string, protein: string | null): string | null {
  const g = pad2(group)
  if (protein !== null) {
    const exact = TWO_FIELD[`${gene}*${g}:${pad2(protein)}`]
    if (exact) return exact
  }
  const broad = FIRST_FIELD_BROAD[`${gene}*${g}`]
  if (broad) return broad
  return firstFieldSerologic(gene, g)
}

const GENE_FAMILY: Record<string, SerologicFamily | AlleleOnlyLocus> = {
  A: "A",
  B: "B",
  C: "C",
  DRB1: "DR",
  DRB3: "DR5x",
  DRB4: "DR5x",
  DRB5: "DR5x",
  DQB1: "DQ",
  DQA1: "DQA1",
  DPA1: "DPA1",
  DPB1: "DPB1",
}

/** Which typing locus a family is recorded under. */
export const FAMILY_LOCUS: Record<SerologicFamily | AlleleOnlyLocus, HlaLocus> = {
  A: "A",
  B: "B",
  C: "C",
  DR: "DRB1",
  DR5x: "DRB345",
  DQ: "DQB1",
  DQA1: "DQA1",
  DPA1: "DPA1",
  DPB1: "DPB1",
}

/** Default gene for bare values typed into a locus cell. */
const LOCUS_DEFAULT_GENE: Record<HlaLocus, string> = {
  A: "A",
  B: "B",
  C: "C",
  DRB1: "DRB1",
  DRB345: "DRB4",
  DQA1: "DQA1",
  DQB1: "DQB1",
  DPA1: "DPA1",
  DPB1: "DPB1",
}

const LOCUS_SEROLOGIC_PREFIX: Partial<Record<HlaLocus, string>> = {
  A: "A",
  B: "B",
  C: "Cw",
  DRB1: "DR",
  DQB1: "DQ",
}

/* ------------------------------------------------------------------ */
/* Parsing                                                             */
/* ------------------------------------------------------------------ */

const ALLELE_RE =
  /^(?:HLA-)?(A|B|C|DRB1|DRB3|DRB4|DRB5|DQA1|DQB1|DPA1|DPB1)\*(\d{1,3})(?::(\d{2,3}))?(?::\d{2,3}){0,2}([NLSQCA])?(?:P|G)?$/

const SEROLOGIC_RE = /^(A|B|CW|C|DR|DQ)(\d{1,4})$/

/**
 * Parse an HLA value. `locus` gives context for bare values typed into a
 * typing grid cell ("02:01" in the A cell → A*02:01; "24" → A24).
 */
export function parseHla(raw: string, locus?: HlaLocus): ParseResult {
  const value = raw.trim().toUpperCase().replace(/\s+/g, "")
  if (value === "") return { ok: false, error: "Empty value." }

  if (value === "BW4" || value === "BW6") {
    if (locus) return { ok: false, error: `Bw status is not typing for ${locus}.` }
    return { ok: true, spec: { kind: "bw", antigen: value === "BW4" ? "Bw4" : "Bw6" } }
  }

  let candidate = value
  if (locus) {
    if (/^\d{1,3}:\d{2,3}(:\d{2,3}){0,2}[NLSQCA]?[PG]?$/.test(value)) {
      candidate = `${LOCUS_DEFAULT_GENE[locus]}*${value}`
    } else if (/^\d{1,4}$/.test(value)) {
      const prefix = LOCUS_SEROLOGIC_PREFIX[locus]
      candidate = locus === "DRB345" && ["51", "52", "53"].includes(value)
        ? `DR${value}`
        : prefix ? `${prefix.toUpperCase()}${value}` : `${LOCUS_DEFAULT_GENE[locus]}*${value}`
    } else if (locus === "DRB345" && /^[345]\*\d/.test(value)) {
      candidate = `DRB${value}`
    }
  }

  const allele = ALLELE_RE.exec(candidate)
  if (allele) {
    const [, gene, groupRaw, proteinRaw, suffix] = allele
    const group = pad2(groupRaw)
    const protein = proteinRaw ? pad2(proteinRaw) : null
    const family = GENE_FAMILY[gene]
    if (locus && FAMILY_LOCUS[family] !== locus) return { ok: false, error: `${gene} does not belong in ${locus}.` }
    const name = protein ? `${gene}*${group}:${protein}` : `${gene}*${group}`
    return {
      ok: true,
      spec: {
        kind: "allele",
        gene,
        group,
        protein,
        name,
        suffix: suffix || null,
        serologic: alleleToSerologic(gene, group, protein),
        family,
      },
    }
  }

  const sero = SEROLOGIC_RE.exec(candidate)
  if (sero) {
    const [, prefixRaw, number] = sero
    const prefix = prefixRaw === "C" || prefixRaw === "CW" ? "Cw" : prefixRaw
    const antigen = `${prefix}${Number(number)}`
    if (!KNOWN_SEROLOGIC.has(antigen)) {
      return { ok: false, error: `${antigen} is not a recognized serologic antigen.` }
    }
    const family: SerologicFamily =
      prefix === "A" ? "A"
      : prefix === "B" ? "B"
      : prefix === "Cw" ? "C"
      : prefix === "DQ" ? "DQ"
      : ["DR51", "DR52", "DR53"].includes(antigen) ? "DR5x"
      : "DR"
    if (locus && FAMILY_LOCUS[family] !== locus) return { ok: false, error: `${antigen} does not belong in ${locus}.` }
    return { ok: true, spec: { kind: "serologic", family, antigen, isBroad: isBroad(antigen) } }
  }

  return {
    ok: false,
    error: `Could not read "${raw.trim()}". Use a serologic name (A2, B44, Cw9, DR15, DQ7) or an allele (A*02:01, DPB1*04:01).`,
  }
}

/** Canonical display string for a parsed spec. */
export function specLabel(spec: HlaSpec): string {
  if (spec.kind === "allele") return `${spec.name}${spec.suffix ?? ""}`
  return spec.antigen
}

/** Normalize free text; returns the canonical label or null if invalid. */
export function normalizeHla(raw: string, locus?: HlaLocus): string | null {
  const parsed = parseHla(raw, locus)
  return parsed.ok ? specLabel(parsed.spec) : null
}

/* ------------------------------------------------------------------ */
/* Donor antigen profile                                               */
/* ------------------------------------------------------------------ */

type FamilyProfile = {
  typedGenes: Set<string>
  typed: boolean
  /** Serologic antigens carried, including ancestors. */
  antigens: Set<string>
  /** Antigens typed only at a broad level (splits unresolved). */
  unresolvedBroads: Set<string>
  /** Two-field alleles carried. */
  alleles: Set<string>
  /** Allele groups (first field) carried, e.g. "DPB1*04". */
  groups: Set<string>
  /** True when every typed value is at two-field resolution. */
  highResolution: boolean
}

export type DonorProfile = {
  families: Record<SerologicFamily | AlleleOnlyLocus, FamilyProfile>
  bw4: boolean | null
  bw6: boolean | null
  invalid: Array<{ locus: HlaLocus; value: string; error: string }>
  nullAlleles: Array<string>
}

const emptyFamily = (): FamilyProfile => ({
  typedGenes: new Set(),
  typed: false,
  antigens: new Set(),
  unresolvedBroads: new Set(),
  alleles: new Set(),
  groups: new Set(),
  highResolution: true,
})

export function buildProfile(typing: HlaTyping): DonorProfile {
  const families: DonorProfile["families"] = {
    A: emptyFamily(),
    B: emptyFamily(),
    C: emptyFamily(),
    DR: emptyFamily(),
    DR5x: emptyFamily(),
    DQ: emptyFamily(),
    DQA1: emptyFamily(),
    DPA1: emptyFamily(),
    DPB1: emptyFamily(),
  }
  const invalid: DonorProfile["invalid"] = []
  const nullAlleles: Array<string> = []
  const bOriginal: Array<string | null> = []

  const loci: ReadonlyArray<HlaLocus> = [
    "A", "B", "C", "DRB1", "DRB345", "DQA1", "DQB1", "DPA1", "DPB1",
  ]

  for (const locus of loci) {
    for (const value of typing[locus]) {
      if (value.trim() === "") continue
      const parsed = parseHla(value, locus)
      if (!parsed.ok) {
        invalid.push({ locus, value, error: parsed.error })
        continue
      }
      const spec = parsed.spec
      if (spec.kind === "bw") continue

      if (spec.kind === "allele") {
        families[spec.family].typedGenes.add(spec.gene)
        if (spec.suffix === "N") {
          nullAlleles.push(spec.name + "N")
          families[spec.family].typed = true
          continue
        }
        const fam = families[spec.family]
        if (spec.family === "B") bOriginal.push(spec.serologic)
        fam.typed = true
        fam.groups.add(`${spec.gene}*${spec.group}`)
        if (spec.protein) fam.alleles.add(spec.name)
        else fam.highResolution = false
        if (spec.serologic) {
          for (const a of withAncestors(spec.serologic)) fam.antigens.add(a)
          if (isBroad(spec.serologic)) fam.unresolvedBroads.add(spec.serologic)
        }
        continue
      }

      const fam = families[spec.family]
      if (spec.family === "B") bOriginal.push(spec.antigen)
      const drGene = { DR51: "DRB5", DR52: "DRB3", DR53: "DRB4" }[spec.antigen]
      if (drGene) fam.typedGenes.add(drGene)
      fam.typed = true
      fam.highResolution = false
      for (const a of withAncestors(spec.antigen)) fam.antigens.add(a)
      if (spec.isBroad) fam.unresolvedBroads.add(spec.antigen)
    }
  }

  for (const fam of Object.values(families)) {
    if (!fam.typed) fam.highResolution = false
  }

  // Bw4/Bw6: explicit typing wins; otherwise derive from B antigens.
  // The first assignment is the most specific; ancestors must not override it.
  const bAssignments = bOriginal.map((antigen) => antigen === null ? undefined
    : withAncestors(antigen).find((a) => BW4_B.has(a) || BW6_B.has(a)))
  const derivedBw4 = bAssignments.some((a) => a !== undefined && BW4_B.has(a))
  const derivedBw6 = bAssignments.some((a) => a !== undefined && BW6_B.has(a))
  const bResolved = families.B.typed && bAssignments.every((a) => a !== undefined)

  const bw = (explicit: HlaTyping["bw4"], derived: boolean): boolean | null => {
    if (explicit === "yes") return true
    if (explicit === "no") return false
    if (derived) return true
    return bResolved ? false : null
  }

  return {
    families,
    bw4: bw(typing.bw4, derivedBw4),
    bw6: bw(typing.bw6, derivedBw6),
    invalid,
    nullAlleles,
  }
}

/* ------------------------------------------------------------------ */
/* Virtual crossmatch                                                  */
/* ------------------------------------------------------------------ */

export type Reactivity = "definite" | "possible" | "none"

export type CrossmatchHit = {
  target: string
  reactivity: Reactivity
  reason: string
}

/** Does the donor carry `target` (an antibody or unacceptable antigen)? */
export function donorCarries(target: string, profile: DonorProfile): CrossmatchHit {
  const parsed = parseHla(target)
  if (!parsed.ok) {
    return { target, reactivity: "possible", reason: `Unreadable entry: ${parsed.error}` }
  }
  const spec = parsed.spec

  if (spec.kind === "bw") {
    const has = spec.antigen === "Bw4" ? profile.bw4 : profile.bw6
    if (has === true) return { target, reactivity: "definite", reason: `Donor is ${spec.antigen} positive.` }
    if (has === null) {
      return { target, reactivity: "possible", reason: `Donor ${spec.antigen} status cannot be determined from the typing.` }
    }
    return { target, reactivity: "none", reason: `Donor is ${spec.antigen} negative.` }
  }

  const fam = profile.families[spec.family]
  const drGene = spec.kind === "allele" ? spec.gene
    : { DR51: "DRB5", DR52: "DRB3", DR53: "DRB4" }[spec.antigen]
  if (spec.family === "DR5x" && drGene && !fam.typedGenes.has(drGene)) {
    return { target, reactivity: "possible", reason: `Donor ${drGene} gene is not typed.` }
  }
  if (!fam.typed) {
    return {
      target,
      reactivity: "possible",
      reason: `Donor ${FAMILY_LOCUS[spec.family]} locus is not typed.`,
    }
  }

  if (spec.kind === "serologic") {
    if (fam.antigens.has(spec.antigen)) {
      return { target, reactivity: "definite", reason: `Donor carries ${spec.antigen} (or an equivalent split).` }
    }
    const blockingBroad = ancestorsOf(spec.antigen).find((a) => fam.unresolvedBroads.has(a))
    if (blockingBroad) {
      return {
        target,
        reactivity: "possible",
        reason: `Donor typed only as ${blockingBroad}; ${spec.antigen} cannot be excluded.`,
      }
    }
    return { target, reactivity: "none", reason: `Donor does not carry ${spec.antigen}.` }
  }

  // Allele-level target.
  const groupKey = `${spec.gene}*${spec.group}`
  if (spec.protein === null) {
    if (fam.groups.has(groupKey)) {
      return { target, reactivity: "definite", reason: `Donor carries an allele in group ${groupKey}.` }
    }
    if (spec.serologic && !fam.highResolution && (fam.antigens.has(spec.serologic) ||
      ancestorsOf(spec.serologic).some((a) => fam.unresolvedBroads.has(a)))) {
      return { target, reactivity: "possible", reason: `Donor serology ${spec.serologic} is compatible with ${groupKey}.` }
    }
    return { target, reactivity: "none", reason: `Donor has no ${groupKey} allele.` }
  }

  if (fam.alleles.has(spec.name)) {
    return { target, reactivity: "definite", reason: `Donor carries ${spec.name}.` }
  }
  if (fam.highResolution) {
    return { target, reactivity: "none", reason: `Donor is typed at two-field resolution and lacks ${spec.name}.` }
  }
  const serologicMatch =
    spec.serologic !== null &&
    (fam.antigens.has(spec.serologic) ||
      ancestorsOf(spec.serologic).some((a) => fam.unresolvedBroads.has(a)))
  if (serologicMatch || fam.groups.has(groupKey)) {
    return {
      target,
      reactivity: "possible",
      reason: `Donor typing is low resolution; ${spec.name} cannot be excluded.`,
    }
  }
  return { target, reactivity: "none", reason: `Donor does not carry ${spec.name} or its serologic equivalent.` }
}

/* ------------------------------------------------------------------ */
/* Mismatch summary (informational)                                    */
/* ------------------------------------------------------------------ */

/** Serologic-level mismatches at A, B, DR (0–6), donor antigens absent in recipient. */
export function abDrMismatches(
  donor: HlaTyping,
  recipient: HlaTyping
): { A: number; B: number; DR: number; total: number } | null {
  const sero = (typing: HlaTyping, locus: HlaLocus): Array<string> | null => {
    const out: Array<string> = []
    for (const v of typing[locus]) {
      if (v.trim() === "") continue
      const p = parseHla(v, locus)
      if (!p.ok) return null
      const s = p.spec
      if (s.kind === "allele" && s.suffix === "N") continue
      if (s.kind === "serologic") out.push(s.antigen)
      else if (s.kind === "allele" && s.serologic) out.push(s.serologic)
      else return null
    }
    return out.length > 0 ? out : null
  }
  const count = (locus: HlaLocus): number | null => {
    const d = sero(donor, locus)
    const r = sero(recipient, locus)
    if (!d || !r) return null
    const recipientSet = new Set(r.flatMap(withAncestors))
    const donorDistinct = [...new Set(d)]
    // A homozygous donor (one value) can contribute at most one mismatch.
    return donorDistinct.filter((a) => !recipientSet.has(a)).length
  }
  const A = count("A")
  const B = count("B")
  const DR = count("DRB1")
  if (A === null || B === null || DR === null) return null
  return { A, B, DR, total: A + B + DR }
}
