import { createElement } from "react"
import type { ReactElement } from "react"
import { describe, expect, it } from "vitest"
import { renderToStaticMarkup as renderMarkup } from "react-dom/server"
import {
  RouterContextProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from "@tanstack/react-router"
import type { MatchRow } from "@/domain/match-types"
import { ScreeningResults } from "./screening-results"

// ScreeningResults renders router <Link>s, which need a router in context.
const router = createRouter({ routeTree: createRootRoute(), history: createMemoryHistory() })
const render = (element: ReactElement) =>
  renderMarkup(createElement(RouterContextProvider, { router, children: element }))

const row = (id: string, overall: MatchRow["overall"]): MatchRow => ({
  id,
  source: "screening",
  runId: "run_1",
  patientId: `pat_${id}`,
  donorId: "don_1",
  patientName: `Candidate ${id}`,
  donorCode: "AHFK214",
  overall,
  blockerCount: overall === "fail" ? 1 : 0,
  missingCount: overall === "review" ? 2 : 0,
  criteriaVersion: 3,
  decision: null,
  outOfDate: false,
  createdAt: "2026-11-14T12:00:00.000Z",
})

describe("ScreeningResults", () => {
  it("states the screening caveats and prefills Check a pair", () => {
    const html = render(
      createElement(ScreeningResults, { donorId: "don_1", rows: [row("a", "pass")], criteriaVersion: 3, emptyText: "x" })
    )
    expect(html).toContain("Screening order, not OPTN allocation")
    expect(html).toContain("Logistics are not assessed until pair inputs are entered")
    expect(html).toContain("(v3)")
    expect(html).toContain("patientId=pat_a")
    expect(html).toContain("donorId=don_1")
    expect(html).toContain("Check this pair")
  })

  it("keeps rank numbering across keyset pages", () => {
    const html = render(
      createElement(ScreeningResults, {
        donorId: "don_1",
        rows: [row("a", "pass"), row("b", "review")],
        rankOffset: 50,
        emptyText: "x",
      })
    )
    const body = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? ""
    const ranks = [...body.matchAll(/<tr[^>]*><td[^>]*>(\d+)<\/td>/g)].map((m) => m[1])
    expect(ranks).toEqual(["51", "52"])
  })

  it("shows the empty text when the run has no results", () => {
    const html = render(createElement(ScreeningResults, { donorId: "don_1", rows: [], emptyText: "Nothing yet." }))
    expect(html).toContain("No screening results")
    expect(html).toContain("Nothing yet.")
  })
})
