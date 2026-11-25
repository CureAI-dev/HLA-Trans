import { useSyncExternalStore } from "react"
import { EMPTY_PROGRESS, readProgress, writeProgress } from "./guide-progress"
import type { GuideProgress } from "./guide-progress"

export type GuideState = {
  userId: string | null
  progress: GuideProgress
  /** The list of tutorials is open. */
  dialog: boolean
  notice: "welcome" | "finished" | null
  /** The tutorial that is running. */
  active: string | null
  /** Show an example of the header's "matching" button. */
  sampleRun: boolean
}

const INITIAL: GuideState = {
  userId: null,
  progress: EMPTY_PROGRESS,
  dialog: false,
  notice: null,
  active: null,
  sampleRun: false,
}

// Changed only in effects and event handlers, so the server always renders INITIAL.
let state = INITIAL
const listeners = new Set<() => void>()

export const guideState = (): GuideState => state

export function setGuide(patch: Partial<GuideState>): void {
  state = { ...state, ...patch }
  listeners.forEach((notify) => notify())
}

export function useGuide<T>(select: (s: GuideState) => T): T {
  return useSyncExternalStore(
    (notify) => {
      listeners.add(notify)
      return () => listeners.delete(notify)
    },
    () => select(state),
    () => select(INITIAL)
  )
}

export function loadGuideUser(userId: string): void {
  if (state.userId === userId) return
  setGuide({ ...INITIAL, userId, progress: readProgress(userId) })
}

export function updateProgress(
  change: (p: GuideProgress) => GuideProgress
): void {
  const progress = change(state.progress)
  setGuide({ progress })
  if (state.userId) writeProgress(state.userId, progress)
}

export const openGuide = (): void => setGuide({ dialog: true })
