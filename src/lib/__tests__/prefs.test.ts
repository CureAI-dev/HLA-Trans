import { describe, expect, it } from "vitest"
import { parsePrefs } from "../prefs"

describe("parsePrefs", () => {
  it("defaults safely", () => {
    expect(parsePrefs(() => undefined)).toEqual({ theme: "light" })
  })
  it("reads the theme", () => {
    expect(
      parsePrefs((n) => (n === "hla_theme" ? "dark" : undefined)).theme
    ).toBe("dark")
  })
  it("ignores unknown theme values", () => {
    expect(parsePrefs(() => "purple").theme).toBe("light")
  })
})
