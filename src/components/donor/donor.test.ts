import { createElement } from "react"
import { describe, expect, it } from "vitest"
import { renderToStaticMarkup as renderMarkup } from "react-dom/server"
import type { ReactElement } from "react"
import {
  RouterContextProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from "@tanstack/react-router"
import { ScreeningTable } from "./screening-table"
import { emptyDonor, emptyPatient } from "@/domain/factories"
import { DEFAULT_CRITERIA } from "@/domain/criteria"
import { screenDonor } from "@/domain/engine"

// ScreeningTable renders router <Link>s, which need a router in context.
const router = createRouter({
  routeTree: createRootRoute(),
  history: createMemoryHistory(),
})
const renderToStaticMarkup = (element: ReactElement) =>
  renderMarkup(
    createElement(RouterContextProvider, { router, children: element })
  )

describe("donor screening presentation", () => {
  it("explains missing logistics, listing fallback and pediatric priority and prefills the pair", () => {
    const donor = emptyDonor()
    donor.identity.ageYears = 16
    const patient = emptyPatient()
    patient.listing.state = "active"
    patient.listing.listingDate = "2026-01-01"
    patient.identity.firstName = "Candidate"
    const rows = screenDonor(
      donor,
      [patient],
      DEFAULT_CRITERIA,
      new Date("2026-11-14T00:00:00Z")
    )
    const html = renderToStaticMarkup(
      createElement(ScreeningTable, {
        donor,
        rows,
        now: new Date("2026-11-14T00:00:00Z"),
      })
    )
    expect(html).toContain("Screening order, not OPTN allocation")
    expect(html).toContain(
      "Logistics are not assessed until pair inputs are entered"
    )
    expect(html).toContain("Pediatric candidates are ranked first")
    expect(html).toContain("from listing date")
    expect(html).toContain("patientId=")
    expect(html).toContain("donorId=")
    expect(html).toContain("Check this pair")
  })
  it.each([
    ["missing birth date", "", "2026-01-01", "Unknown"],
    ["future birth date", "2099-01-01", "", "Unknown"],
    ["birth after listing", "2026-02-01", "2026-01-01", "Unknown"],
    ["invalid listing date", "2000-01-01", "2026-02-30", "Unknown"],
    [
      "pediatric at listing, adult now",
      "2008-06-01",
      "2026-01-01",
      "Pediatric",
    ],
    ["adult at listing", "2000-01-01", "2026-01-01", "No"],
    ["pediatric without listing date", "2020-01-01", "", "Pediatric"],
    ["adult without listing date", "2000-01-01", "", "No"],
  ])("shows eligibility for %s", (_case, birthDate, listingDate, expected) => {
    const donor = emptyDonor()
    const patient = emptyPatient()
    patient.listing.state = "active"
    patient.identity.dateOfBirth = birthDate
    patient.listing.listingDate = listingDate
    const rows = screenDonor(
      donor,
      [patient],
      DEFAULT_CRITERIA,
      new Date("2026-11-14T00:00:00Z")
    )
    const html = renderToStaticMarkup(
      createElement(ScreeningTable, {
        donor,
        rows,
        now: new Date("2026-11-14T00:00:00Z"),
      })
    )
    const body = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? ""
    const cells = [...body.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)]
    expect(cells[3]?.[1].replace(/<[^>]*>/g, "")).toBe(expected)
  })
})
