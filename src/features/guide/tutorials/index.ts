import type { Tutorial } from "../guide.types"
import { matchingTutorials } from "./matching"
import { recordTutorials } from "./records"
import { resultTutorials } from "./results"
import { settingsTutorials } from "./settings"
import { startTutorials } from "./start"

/** In the order shown. Loaded when the guide opens, not with the app. */
export const TUTORIALS: ReadonlyArray<Tutorial> = [
  ...startTutorials,
  ...recordTutorials,
  ...matchingTutorials,
  ...resultTutorials,
  ...settingsTutorials,
]

export const tutorialById = (id: string): Tutorial | undefined =>
  TUTORIALS.find((t) => t.id === id)

/** Whole minutes at a reading pace of about 22 seconds a step. */
export const minutesOf = (t: Tutorial): number =>
  Math.max(1, Math.round((t.steps.length * 22) / 60))

/** Every word of the query must appear in the name, summary, keywords or a step title. */
export function searchTutorials(query: string): ReadonlyArray<Tutorial> {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  return TUTORIALS.filter((t) => {
    const text = [t.name, t.summary, t.keywords, ...t.steps.map((s) => s.title)]
      .join(" ")
      .toLowerCase()
    return words.every((w) => text.includes(w))
  })
}

/** Where a tutorial belongs, given a path: 0 best, -1 not at all. `$x` matches one segment. */
function rank(t: Tutorial, pathname: string): number {
  return t.pages.findIndex((page) => {
    const a = page.split("/")
    const b = pathname.split("/")
    return (
      a.length === b.length &&
      a.every((part, i) =>
        part.startsWith("$")
          ? b[i] !== "new" && b[i] !== "check"
          : part === b[i]
      )
    )
  })
}

/** The unfinished tutorial that fits a page best. */
export function tutorialForPage(
  pathname: string,
  done: ReadonlyArray<string>
): Tutorial | undefined {
  return TUTORIALS.map((t) => ({ t, r: rank(t, pathname) }))
    .filter(({ t, r }) => r >= 0 && !done.includes(t.id))
    .sort((a, b) => a.r - b.r)
    .at(0)?.t
}
