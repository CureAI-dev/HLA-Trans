import { describe, expect, it } from "vitest"
import { parsePrefs } from "../prefs"

describe("parsePrefs", () => {
  it("defaults safely", () => {
    expect(parsePrefs(() => undefined)).toEqual({ theme: "light", clinician: "" })
  })
  it("reads values and clamps the clinician name", () => {
    const jar: Record<string, string> = { hla_theme: "dark", hla_clinician: `  ${"x".repeat(300)}  ` }
    const prefs = parsePrefs((n) => jar[n])
    expect(prefs.theme).toBe("dark")
    expect(prefs.clinician).toHaveLength(200)
  })
  it("ignores unknown theme values", () => {
    expect(parsePrefs(() => "purple").theme).toBe("light")
  })
})
