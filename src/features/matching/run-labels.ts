import type { RunRow } from "@/domain/match-types"

export const TRIGGER_LABEL: Record<RunRow["trigger"], string> = {
  "donor.created": "New donor",
  "patient.created": "New patient",
  manual: "Manual rerun",
  seed: "Demo data",
}

export const STATUS_LABEL: Record<RunRow["status"], string> = {
  queued: "Queued",
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
  cancelled: "Cancelled",
}

export const isLiveRun = (run: RunRow) =>
  run.status === "queued" || run.status === "running"

export function formatDuration(seconds: number) {
  const s = Math.max(0, Math.round(seconds))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}
