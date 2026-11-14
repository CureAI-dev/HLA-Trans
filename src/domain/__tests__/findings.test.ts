import { expect, it } from "vitest"
import {
  finding,
  missingFinding,
  outcomeFinding,
  ruleResult,
  worst,
} from "../rules/findings"

it("fills finding metadata and preserves supplied evidence", () => {
  expect(
    finding({ code: "x", status: "pass", title: "Test", detail: "Detail" })
  ).toMatchObject({ missing: false, evidence: "", source: "center practice" })
  expect(
    finding({
      code: "x",
      status: "info",
      title: "Test",
      detail: "Detail",
      evidence: "8",
      source: "guide",
    })
  ).toMatchObject({ evidence: "8", source: "guide" })
})
it("marks missing inputs review", () =>
  expect(missingFinding("x", "Missing", "Detail", "guide")).toMatchObject({
    status: "review",
    missing: true,
    source: "guide",
  }))
it("uses configured outcomes", () =>
  expect(
    outcomeFinding("fail", { code: "x", title: "Test", detail: "Detail" })
      .status
  ).toBe("fail"))
it("aggregates by worst outcome with info and empty as pass", () => {
  expect(worst([])).toBe("pass")
  expect(worst([{ status: "info" }])).toBe("pass")
  expect(worst([{ status: "review" }, { status: "pass" }])).toBe("review")
  expect(
    ruleResult("abo", [
      missingFinding("x", "Missing", "Detail"),
      outcomeFinding("fail", { code: "y", title: "Fail", detail: "Detail" }),
    ]).status
  ).toBe("fail")
})
