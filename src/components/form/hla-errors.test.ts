import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { createElement } from "react"
import { emptyHlaTyping } from "@/domain/factories"
import { HlaTypingGrid } from "./hla-typing-grid"
import { resolveHlaError } from "./hla-errors"

describe("HLA validation errors", () => {
  it("preserves a schema error after an allele edit clears its local error", () => {
    expect(resolveHlaError("A2", undefined, "Maximum 200 characters")).toBe(
      "Maximum 200 characters"
    )
    expect(
      resolveHlaError(
        "A2",
        { raw: "garbage", message: "Invalid A typing." },
        "Maximum 200 characters"
      )
    ).toBe("Maximum 200 characters")
  })
  it("shows a local error only for its rejected value", () => {
    const rejected = { raw: "garbage", message: "Invalid A typing." }
    expect(resolveHlaError("garbage", rejected)).toBe("Invalid A typing.")
    expect(resolveHlaError("A2", rejected)).toBeUndefined()
    expect(resolveHlaError("", rejected)).toBeUndefined()
  })
  it("renders schema errors linked to allele, method, date and tri-state controls", () => {
    const value = emptyHlaTyping()
    value.A[0] = "A2"
    value.method = "x".repeat(201)
    const errors = {
      "A.0": "Allele exceeds 200 characters",
      method: "Method exceeds 200 characters",
      typingDate: "Invalid typing date",
      bw4: "Invalid Bw4",
      bw6: "Invalid Bw6",
    }
    const html = renderToStaticMarkup(
      createElement(HlaTypingGrid, { value, onChange: () => {}, errors })
    )
    for (const message of Object.values(errors)) {
      expect(html).toContain(message)
      const errorId = html.match(
        new RegExp('id="([^"]+)" role="alert"[^>]*>' + message)
      )?.[1]
      expect(errorId).toBeDefined()
      expect(html).toContain(`aria-describedby="${errorId}"`)
    }
  })
})
