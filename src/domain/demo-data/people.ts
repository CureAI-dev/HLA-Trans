import type { HlaTyping } from "../schema"

/** Synthetic records. Names are common given/family names combined at random; no real people. */
export function demoNow(): Date {
  const d = new Date()
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12)
  )
}

/** ISO date `days` before demoNow (negative = future). Keeps ages and durations valid over time. */
export function daysAgo(days: number): string {
  return new Date(demoNow().getTime() - days * 86_400_000)
    .toISOString()
    .slice(0, 10)
}

/** ISO timestamp `days` before demoNow, for createdAt/updatedAt. */
export function stampDaysAgo(days: number): string {
  return new Date(demoNow().getTime() - days * 86_400_000).toISOString()
}

/** Date of birth for an age in whole years plus extra days. */
export function bornYearsAgo(years: number, extraDays = 90): string {
  const n = demoNow()
  return new Date(
    Date.UTC(n.getUTCFullYear() - years, n.getUTCMonth(), n.getUTCDate()) -
      extraDays * 86_400_000
  )
    .toISOString()
    .slice(0, 10)
}

export const CENTERS = [
  "Riverside University Medical Center",
  "Northlake Heart Institute",
  "St. Brendan's Hospital",
  "Mercy Valley Medical Center",
] as const
export const OPOS = [
  "Great Lakes Donor Network",
  "Sierra Gift of Life",
  "Heartland Organ Alliance",
  "Atlantic Donor Services",
] as const
export const DONOR_HOSPITALS = [
  "Lakeshore Regional Medical Center",
  "Pinecrest Community Hospital",
  "St. Adelaide Trauma Center",
  "Cedar Falls General Hospital",
  "Bayview Children's Hospital",
  "Summit County Medical Center",
] as const
export const ATTENDINGS = [
  "Dr. Priya Raman",
  "Dr. Marcus Feld",
  "Dr. Elena Okafor",
  "Dr. James Whitaker",
] as const

export const PATIENT_NAMES: ReadonlyArray<[first: string, last: string]> = [
  ["Maya", "Chen"],
  ["Daniel", "Okonkwo"],
  ["Sofia", "Ramirez"],
  ["Ethan", "Walsh"],
  ["Aisha", "Rahman"],
  ["Lucas", "Moreau"],
  ["Grace", "Kim"],
  ["Mateo", "Silva"],
  ["Hannah", "Lindqvist"],
  ["Omar", "Haddad"],
  ["Chloe", "Nguyen"],
  ["Samuel", "Adeyemi"],
  ["Isabel", "Costa"],
  ["Noah", "Fischer"],
  ["Leila", "Farahani"],
  ["Jacob", "Brennan"],
  ["Ava", "Patel"],
  ["Theo", "Novak"],
  ["Zara", "Mensah"],
  ["Henry", "Takahashi"],
  ["Lily", "Ortega"],
  ["Elijah", "Grant"],
  ["Mila", "Kowalski"],
  ["Arjun", "Mehta"],
]

/**
 * Compact HLA typing builder. Each argument is "first second" for one locus;
 * a single value means homozygous (second cell left blank).
 */
export function typing(
  loci: {
    A: string
    B: string
    C: string
    DRB1: string
    DRB345: string
    DQA1: string
    DQB1: string
    DPA1: string
    DPB1: string
  },
  typingDate: string,
  method = "NGS, two-field (high resolution)"
): HlaTyping {
  const pair = (s: string): [string, string] => {
    const [a = "", b = ""] = s.trim().split(/\s+/)
    return [a, b]
  }
  return {
    A: pair(loci.A),
    B: pair(loci.B),
    C: pair(loci.C),
    DRB1: pair(loci.DRB1),
    DRB345: pair(loci.DRB345),
    DQA1: pair(loci.DQA1),
    DQB1: pair(loci.DQB1),
    DPA1: pair(loci.DPA1),
    DPB1: pair(loci.DPB1),
    bw4: "unknown",
    bw6: "unknown",
    typingDate,
    method,
  }
}
