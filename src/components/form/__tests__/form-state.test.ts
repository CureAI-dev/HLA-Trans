import { describe, expect, it } from "vitest"
import { formReducer, initialFormState } from "../use-form-state"
import { splitSectionErrors } from "../section-errors"

describe("formReducer", () => {
  const start = initialFormState({ a: { b: 1, c: 2 }, d: "x" })

  it("sets a path, marks dirty, clears that path's errors only", () => {
    const withErrors = { ...start, errors: { "a.b": "bad", d: "bad" } }
    const next = formReducer(withErrors, { type: "set", path: "a.b", value: 5 })
    expect(next.value.a.b).toBe(5)
    expect(next.dirty).toBe(true)
    expect(next.errors).toEqual({ d: "bad" })
  })

  it("keeps untouched branches referentially equal (memoised sections skip re-render)", () => {
    const next = formReducer(start, { type: "set", path: "d", value: "y" })
    expect(next.value.a).toBe(start.value.a)
  })

  it("keeps the errors object when the edit clears nothing", () => {
    const withErrors = { ...start, errors: { d: "bad" } }
    const next = formReducer(withErrors, { type: "set", path: "a.c", value: 3 })
    expect(next.errors).toBe(withErrors.errors)
  })

  it("accepts an updater for errors (server issues merge into client errors)", () => {
    const withErrors = { ...start, errors: { d: "bad" } }
    const next = formReducer(withErrors, {
      type: "errors",
      errors: (prev) => ({ ...prev, "a.b": "server" }),
    })
    expect(next.errors).toEqual({ d: "bad", "a.b": "server" })
  })

  it("reset clears dirty and errors", () => {
    const dirty = formReducer(start, { type: "set", path: "d", value: "y" })
    const reset = formReducer(dirty, { type: "reset", value: dirty.value })
    expect(reset.dirty).toBe(false)
    expect(reset.errors).toEqual({})
  })
})

describe("splitSectionErrors", () => {
  const ids = ["identity", "serology", "notes"]
  const sectionOf = (key: string) =>
    key === "serologyDate" ? "serology" : key.split(".")[0]

  it("groups errors by section, keyed without the section prefix", () => {
    const out = splitSectionErrors(
      { "identity.mrn": "x", serologyDate: "y", notes: "z" },
      ids,
      sectionOf,
      undefined
    )
    expect(out.identity).toEqual({ mrn: "x" })
    expect(out.serology).toEqual({ serologyDate: "y" })
    expect(out.notes).toEqual({ notes: "z" })
  })

  it("reuses the previous inner object when a section's errors are unchanged", () => {
    const first = splitSectionErrors(
      { "identity.mrn": "x" },
      ids,
      sectionOf,
      undefined
    )
    const second = splitSectionErrors(
      { "identity.mrn": "x", notes: "z" },
      ids,
      sectionOf,
      first
    )
    expect(second.identity).toBe(first.identity)
    expect(second.serology).toBe(first.serology)
    expect(second.notes).not.toBe(first.notes)
  })
})
