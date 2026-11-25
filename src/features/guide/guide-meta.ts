import type { TutorialGroup } from "./guide.types"

/** In the initial bundle (the sidebar card needs it). A test keeps it equal to TUTORIALS.length. */
export const TUTORIAL_COUNT = 17

export const GROUPS: ReadonlyArray<{ id: TutorialGroup; title: string }> = [
  { id: "start", title: "Start here" },
  { id: "records", title: "Patients and donors" },
  { id: "matching", title: "Matching" },
  { id: "results", title: "Results and decisions" },
  { id: "settings", title: "Limits, history and data" },
]
