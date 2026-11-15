import type { RunRow } from "@/domain/match-types"

export function runProgress(run: RunRow, nowMs: number) {
  const startMs = run.startedAt ? Date.parse(run.startedAt) : nowMs
  const elapsedSeconds = Math.max(0, Math.round((nowMs - startMs) / 1000))
  if (run.total === null) return { percent: 0, etaSeconds: null, elapsedSeconds }
  if (run.total === 0) return { percent: 100, etaSeconds: 0, elapsedSeconds }
  const percent = Math.min(100, Math.round((run.processed / run.total) * 100))
  const rate = elapsedSeconds > 0 ? run.processed / elapsedSeconds : 0
  const etaSeconds = rate > 0 ? Math.ceil((run.total - run.processed) / rate) : null
  return { percent, etaSeconds, elapsedSeconds }
}

export function finishedRunIds(prev: ReadonlyArray<string>, next: ReadonlyArray<string>): string[] {
  const live = new Set(next)
  return prev.filter((id) => !live.has(id))
}
