/** Tutorial progress of one user in this browser. Never leaves the browser. */
export type GuideProgress = {
  /** The welcome card was answered. */
  seen: boolean
  done: ReadonlyArray<string>
  /** Paused tutorials: the step to continue from, and how many steps there are. */
  paused: Readonly<Record<string, { step: number; of: number }>>
}

export const EMPTY_PROGRESS: GuideProgress = {
  seen: false,
  done: [],
  paused: {},
}

const key = (userId: string) => `concord-guide:${userId}`
const isCount = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 0

/** Anything unexpected in storage is ignored, never thrown. */
export function parseProgress(raw: string | null): GuideProgress {
  if (!raw) return EMPTY_PROGRESS
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== "object" || value === null) return EMPTY_PROGRESS
    const { seen, done, paused } = value as Record<string, unknown>
    const entries =
      typeof paused === "object" && paused !== null
        ? Object.entries(paused).flatMap(([id, at]) => {
            const p = at as { step?: unknown; of?: unknown } | null
            return p && isCount(p.step) && isCount(p.of) && p.step < p.of
              ? [[id, { step: p.step, of: p.of }] as const]
              : []
          })
        : []
    return {
      seen: seen === true,
      done: Array.isArray(done)
        ? [...new Set(done.filter((id) => typeof id === "string"))]
        : [],
      paused: Object.fromEntries(entries),
    }
  } catch {
    return EMPTY_PROGRESS
  }
}

export function readProgress(userId: string): GuideProgress {
  try {
    return parseProgress(localStorage.getItem(key(userId)))
  } catch {
    return EMPTY_PROGRESS
  }
}

export function writeProgress(userId: string, progress: GuideProgress): void {
  try {
    localStorage.setItem(key(userId), JSON.stringify(progress))
  } catch {
    /* Private window or blocked storage: progress lasts for this visit only. */
  }
}

export const withSeen = (p: GuideProgress): GuideProgress => ({
  ...p,
  seen: true,
})

export function withPaused(
  p: GuideProgress,
  id: string,
  step: number,
  of: number
): GuideProgress {
  // A repeat of a finished tutorial stays finished, and step 1 is the same as not started.
  if (p.done.includes(id) || step === 0) return withSeen(p)
  return { ...p, seen: true, paused: { ...p.paused, [id]: { step, of } } }
}

export function withDone(p: GuideProgress, id: string): GuideProgress {
  const { [id]: _, ...paused } = p.paused
  return {
    seen: true,
    done: p.done.includes(id) ? p.done : [...p.done, id],
    paused,
  }
}

/** 0 to 1. */
export function tutorialProgress(p: GuideProgress, id: string): number {
  if (p.done.includes(id)) return 1
  const at = p.paused[id] as GuideProgress["paused"][string] | undefined
  return at ? at.step / at.of : 0
}

export function overallProgress(p: GuideProgress, count: number): number {
  const part = Object.keys(p.paused).reduce(
    (sum, id) => sum + tutorialProgress(p, id),
    p.done.length
  )
  return count ? Math.min(1, part / count) : 0
}
