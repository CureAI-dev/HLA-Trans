import { describe, expect, it } from "vitest"
import { finishedRunIds, runProgress } from "../run-math"
import type { RunRow } from "@/domain/match-types"

const base: RunRow = {
  id: "run_1", trigger: "donor.created", subjectKind: "donor", subjectId: "don_1", subjectLabel: "AHFK214", criteriaVersion: 1,
  status: "running", total: 200, processed: 50, passCount: 0, reviewCount: 0, failCount: 0, error: null, cancelRequested: false,
  createdBy: "Dr A", createdAt: "2026-11-14T12:00:00.000Z", startedAt: "2026-11-14T12:00:00.000Z", finishedAt: null,
}

describe("runProgress", () => {
  it("computes percent and ETA from observed rate", () => {
    const p = runProgress(base, Date.parse("2026-11-14T12:00:10.000Z"))
    expect(p.percent).toBe(25)
    expect(p.elapsedSeconds).toBe(10)
    expect(p.etaSeconds).toBe(30) // 150 left at 5/s
  })
  it("has no ETA before progress or when total is unknown", () => {
    expect(runProgress({ ...base, processed: 0 }, Date.parse("2026-11-14T12:00:10Z")).etaSeconds).toBeNull()
    expect(runProgress({ ...base, total: null }, Date.parse("2026-11-14T12:00:10Z")).percent).toBe(0)
  })
  it("treats an empty candidate set as complete", () => {
    expect(runProgress({ ...base, total: 0, processed: 0 }, Date.now()).percent).toBe(100)
  })
})

describe("finishedRunIds", () => {
  it("returns ids that left the active list", () => {
    expect(finishedRunIds(["a", "b", "c"], ["b", "d"])).toEqual(["a", "c"])
  })
})
