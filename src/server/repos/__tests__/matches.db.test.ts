import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { closeTestDb, resetTestDb, testDb } from "../../db/test-db.server"
import {
  ensureInitialCriteria,
  latestCriteria,
  publishCriteria,
} from "../criteria.server"
import {
  checkPair,
  decideMatch,
  getMatch,
  listMatches,
} from "../matches.server"
import { insertPatient, updatePatient } from "../patients.server"
import { insertDonor as insertDonorRecord } from "../donors.server"
import { defaultPairInputs } from "@/domain/factories"
import { donor, patient } from "@/domain/__tests__/builders"

const actor = "Dr Ada Okafor"

async function seedPair() {
  const db = testDb()
  await ensureInitialCriteria(db)
  const p = patient({ id: "pat_1", listing: { state: "active" } })
  const d = donor({ id: "don_1", identity: { state: "available" } })
  await insertPatient(db, p, actor)
  await insertDonorRecord(db, d, actor)
  return { db, p, d }
}

describe("match results", () => {
  beforeEach(resetTestDb)
  afterAll(closeTestDb)

  it("recomputes on the server and stores a checked result with snapshots", async () => {
    const { db } = await seedPair()
    const { id } = await checkPair(
      db,
      { patientId: "pat_1", donorId: "don_1", pair: defaultPairInputs() },
      actor
    )
    const detail = await getMatch(db, id)
    expect(detail.source).toBe("checked")
    expect(detail.patient.id).toBe("pat_1")
    expect(detail.result.engineVersion).toBeTruthy()
    expect(detail.outOfDate).toBe(false)
  })

  it("marks results out of date after a record edit or a criteria publish", async () => {
    const { db, p } = await seedPair()
    const { id } = await checkPair(
      db,
      { patientId: "pat_1", donorId: "don_1", pair: defaultPairInputs() },
      actor
    )
    await updatePatient(db, { ...p, notes: "changed" }, 1, actor)
    expect((await getMatch(db, id)).outOfDate).toBe(true)
    const rows = await listMatches(db, {})
    expect(rows.items[0].outOfDate).toBe(true)
    const { id: id2 } = await checkPair(
      db,
      { patientId: "pat_1", donorId: "don_1", pair: defaultPairInputs() },
      actor
    )
    expect((await getMatch(db, id2)).outOfDate).toBe(false)
    await publishCriteria(
      db,
      (await latestCriteria(db)).criteria,
      "No-op republish",
      actor
    )
    expect((await getMatch(db, id2)).outOfDate).toBe(true)
  })

  it("enforces decision rules", async () => {
    const { db } = await seedPair()
    const { id } = await checkPair(
      db,
      { patientId: "pat_1", donorId: "don_1", pair: defaultPairInputs() },
      actor
    )
    const base = {
      verdict: "accept" as const,
      reasons: [],
      clinician: "Dr Ada Okafor",
      rationale: "Reviewed",
      acknowledgedFindings: false,
    }
    await expect(decideMatch(db, id, base, actor)).rejects.toMatchObject({
      code: "VALIDATION",
    })
    await expect(
      decideMatch(db, id, { ...base, verdict: "decline" }, actor)
    ).rejects.toMatchObject({ code: "VALIDATION" })
    await decideMatch(db, id, { ...base, acknowledgedFindings: true }, actor)
    await expect(
      decideMatch(db, id, { ...base, acknowledgedFindings: true }, actor)
    ).rejects.toMatchObject({ code: "CONFLICT" })
    expect((await getMatch(db, id)).decision?.verdict).toBe("accept")
  })
})
