import { describe, expect, it } from "vitest"
import {
  EMPTY_PROGRESS,
  overallProgress,
  parseProgress,
  readProgress,
  tutorialProgress,
  withDone,
  withPaused,
} from "../guide-progress"

describe("guide progress", () => {
  it("ignores damaged storage", () => {
    for (const raw of [null, "", "{", "null", "3", '"x"', "[]"])
      expect(parseProgress(raw)).toEqual(EMPTY_PROGRESS)
    expect(
      parseProgress(
        JSON.stringify({
          seen: "yes",
          done: ["a", 1, "a"],
          paused: { b: { step: 2, of: 5 }, c: { step: 9, of: 5 }, d: null },
        })
      )
    ).toEqual({ seen: false, done: ["a"], paused: { b: { step: 2, of: 5 } } })
  })
  it("works without storage", () => {
    expect(readProgress("u")).toEqual(EMPTY_PROGRESS) // node: no localStorage
  })
  it("pauses, finishes and keeps finished tutorials finished", () => {
    const paused = withPaused(EMPTY_PROGRESS, "a", 3, 6)
    expect(paused.seen).toBe(true)
    expect(tutorialProgress(paused, "a")).toBe(0.5)
    const done = withDone(paused, "a")
    expect(done.paused).toEqual({})
    expect(tutorialProgress(done, "a")).toBe(1)
    expect(withPaused(done, "a", 1, 6).paused).toEqual({})
    expect(withPaused(EMPTY_PROGRESS, "a", 0, 6).paused).toEqual({})
    expect(withDone(done, "a").done).toEqual(["a"])
  })
  it("averages over all tutorials", () => {
    const p = withDone(withPaused(EMPTY_PROGRESS, "b", 1, 2), "a")
    expect(overallProgress(p, 4)).toBe(0.375)
  })
})
