import { describe, expect, it } from "vitest"
import { decodeCursor, encodeCursor } from "../cursor"

describe("cursor", () => {
  it("round-trips", () => {
    const c = { k: "2026-11-14T12:00:00.000Z", id: "pat_1" }
    expect(decodeCursor(encodeCursor(c))).toEqual(c)
  })
  it("rejects garbage instead of throwing", () => {
    expect(decodeCursor("not-base64-json")).toBeNull()
    expect(decodeCursor(encodeCursor({ k: "x", id: "" }))).toBeNull()
  })
})
