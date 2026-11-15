import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { closeTestDb, resetTestDb, testDb } from "../../db/test-db.server"
import { exportAll, importBackup, resetAll } from "../data.server"
import { listMatches } from "../matches.server"
import { listPatients } from "../patients.server"
import { evaluate } from "@/domain/engine"
import { DEFAULT_CRITERIA } from "@/domain/criteria"
import { defaultPairInputs } from "@/domain/factories"
import { donor, patient } from "@/domain/__tests__/builders"

const at = "2026-11-10T10:00:00.000Z"
function legacyBackup() {
  const p = patient({ id: "pat_legacy" })
  const gone = patient({ id: "pat_deleted" }) // deleted in the old app; only its snapshot survives
  const d = donor({ id: "don_legacy" })
  const ev = (id: string, pt: typeof p) => ({
    id,
    createdAt: at,
    createdBy: "Dr Old",
    patientId: pt.id,
    donorId: d.id,
    patientSnapshot: pt,
    donorSnapshot: d,
    criteriaVersionId: "criteria-v1",
    criteriaVersion: 1,
    criteriaSnapshot: DEFAULT_CRITERIA,
    pair: defaultPairInputs(),
    result: evaluate({
      patient: pt,
      donor: d,
      pair: defaultPairInputs(),
      criteria: DEFAULT_CRITERIA,
      now: new Date(at),
    }),
    decision: null,
  })
  return {
    schemaVersion: 1,
    clinicianName: "Dr Old",
    patients: [p],
    donors: [d],
    evaluations: [ev("evl_1", p), ev("evl_2", gone)],
    criteriaVersions: [
      {
        id: "criteria-v1",
        version: 1,
        createdAt: at,
        author: "System",
        changeNote: "Initial",
        criteria: DEFAULT_CRITERIA,
      },
    ],
    audit: [
      {
        id: "aud_old",
        at,
        actor: "Dr Old",
        action: "evaluation.created",
        subjectId: "evl_1",
        summary: "x",
      },
    ],
  }
}

describe("data import/export", () => {
  beforeEach(resetTestDb)
  afterAll(closeTestDb)

  it("imports a v1 localStorage backup, keeping ids, and is idempotent", async () => {
    const db = testDb()
    const first = await importBackup(db, legacyBackup(), "Dr New")
    expect(first).toMatchObject({ patients: 1, donors: 1, matches: 2 })
    expect((await listPatients(db, {})).items.map((r) => r.id)).toEqual([
      "pat_legacy",
    ]) // deleted one stays hidden
    expect((await listMatches(db, {})).items).toHaveLength(2)
    const second = await importBackup(db, legacyBackup(), "Dr New")
    expect(second).toMatchObject({ patients: 0, donors: 0, matches: 0 })
  })

  it("rejects an invalid backup without writing", async () => {
    const db = testDb()
    await expect(
      importBackup(db, { schemaVersion: 1 }, "Dr New")
    ).rejects.toBeTruthy()
    expect((await listPatients(db, {})).items).toHaveLength(0)
  })

  it("exports what it imported and resets to a single criteria version", async () => {
    const db = testDb()
    await importBackup(db, legacyBackup(), "Dr New")
    const out = await exportAll(db)
    expect(out.patients.map((p) => p.id)).toContain("pat_legacy")
    await resetAll(db, "Dr New")
    const after = await exportAll(db)
    expect(after.patients).toHaveLength(0)
    expect(after.criteriaVersions).toHaveLength(1)
  })
})
