/** A location in the app. Everything a step needs on screen is in the URL. */
export type Place = { to: string; search?: Record<string, unknown> }

/** Something for the operator to do before Next works. Runs in the browser only. */
export type Try = {
  /** What to do. A function may show progress. May contain <b>. */
  text: string | (() => string)
  /** Shown when it is done. */
  done?: string
  /** Shown when Next is pressed too early. */
  nudge: string
  /** Done when this is pressed. The tutorial then moves on by itself. */
  press?: string
  /** Done when this returns true. */
  check?: () => boolean
  /** Move on by itself when `check` is true. */
  auto?: boolean
  /** Values that "Fill them in for me" types, by selector. */
  fill?: Record<string, string>
  /** Elements outside the highlight that stay usable, such as an open list. */
  allow?: string
}

export type Step = {
  at: Place
  /** CSS selectors, best first. The first visible one is used. */
  target: string | ReadonlyArray<string>
  side: "top" | "right" | "bottom" | "left"
  align?: "start" | "center" | "end"
  title: string
  /** Trusted HTML from this repository: plain text with <b>. */
  text: string
  /** Title and text worked out from what is on screen. */
  dynamic?: () => { title: string; text: string }
  /** Show the meaning of PASS, REVIEW and FAIL under the text. */
  legend?: boolean
  /** Skip the step when the target is not on the page (a row in an empty table). */
  optional?: boolean
  /** Runs when the step opens, after its target is on the page. */
  before?: () => void
  /** Show an example of the "matching" button in the header. */
  sampleRun?: boolean
  try?: Try
}

export type TutorialGroup =
  "start" | "records" | "matching" | "results" | "settings"

export type Tutorial = {
  id: string
  group: TutorialGroup
  name: string
  summary: string
  /** Extra words for the search. */
  keywords: string
  /** Paths this tutorial is suggested on, best first. */
  pages: ReadonlyArray<string>
  steps: ReadonlyArray<Step>
}

/** A step that runs on a practice screen: demo records, nothing can be saved. */
export const isPractice = (step: Step): boolean =>
  step.at.search?.practice === true || step.at.to.startsWith("/practice/")

/** Selector of a `data-guide` target. */
export const g = (name: string): string => `[data-guide="${name}"]`
