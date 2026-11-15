import { describe, expect, it } from "vitest"
import { z } from "zod"
import { AppError, appErrorAdapter, toAppError } from "../app-error"

describe("toAppError", () => {
  it("keeps AppError", () => {
    const e = new AppError("NOT_FOUND", "Patient not found.")
    expect(toAppError(e)).toBe(e)
  })
  it("maps zod issues to VALIDATION with field paths", () => {
    const r = z
      .object({ a: z.object({ b: z.string() }) })
      .safeParse({ a: { b: 1 } })
    const e = toAppError(r.error)
    expect(e.code).toBe("VALIDATION")
    expect(Object.keys(e.issues)).toEqual(["a.b"])
  })
  it("maps postgres unique violation to CONFLICT and trigger to INTERNAL", () => {
    expect(
      toAppError(Object.assign(new Error("dup"), { code: "23505" })).code
    ).toBe("CONFLICT")
    expect(
      toAppError(Object.assign(new Error("append-only"), { code: "P0001" }))
        .code
    ).toBe("INTERNAL")
  })
  it("reads the postgres code from a wrapped driver error (DrizzleQueryError.cause)", () => {
    const wrapped = new Error("Failed query: insert …", {
      cause: Object.assign(new Error("dup"), { code: "23505" }),
    })
    expect(toAppError(wrapped).code).toBe("CONFLICT")
  })
  it("hides unknown error details", () => {
    const e = toAppError(new Error("connection refused 10.0.0.3"))
    expect(e.code).toBe("INTERNAL")
    expect(e.message).not.toContain("10.0.0.3")
  })
})

describe("appErrorAdapter", () => {
  it("round-trips code and issues", () => {
    const e = new AppError("VALIDATION", "Bad", { "identity.mrn": "Required" })
    const back = appErrorAdapter.fromSerializable(
      appErrorAdapter.toSerializable(e)
    )
    expect(back).toBeInstanceOf(AppError)
    expect(back.code).toBe("VALIDATION")
    expect(back.issues).toEqual({ "identity.mrn": "Required" })
  })
})
