import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { closeTestDb, resetTestDb, testDb } from "../../db/test-db.server"
import {
  getPatient,
  insertPatient,
  listPatients,
  softDeletePatient,
  updatePatient,
  activePatients,
} from "../patients.server"
import {
  availableDonors,
  getDonor,
  insertDonor,
  softDeleteDonor,
  updateDonor,
} from "../donors.server"
import { putSnapshots } from "../snapshots.server"
import { donor, patient } from "@/domain/__tests__/builders"
import { AppError } from "@/lib/app-error"

describe("patients repository", () => {
  beforeEach(resetTestDb)
  afterAll(closeTestDb)
  const actor = "Dr Ada Okafor"

  it("inserts, reads and lists with summary columns only", async () => {
    const db = testDb()
    const p = patient({
      id: "pat_a",
      identity: { firstName: "Maya", lastName: "Chen", mrn: "MRN-1" },
    })
    await insertPatient(db, p, actor)
    const got = await getPatient(db, "pat_a")
    expect(got.version).toBe(1)
    expect(got.record.identity.lastName).toBe("Chen")
    const page = await listPatients(db, { q: "chen" })
    expect(page.items.map((r) => r.fullName)).toEqual(["Maya Chen"])
    expect(page.items[0]).not.toHaveProperty("data")
  })

  it("rejects a stale version with CONFLICT", async () => {
    const db = testDb()
    const p = patient({ id: "pat_b" })
    await insertPatient(db, p, actor)
    await updatePatient(db, { ...p, notes: "one" }, 1, actor)
    await expect(
      updatePatient(db, { ...p, notes: "two" }, 1, actor)
    ).rejects.toMatchObject({ code: "CONFLICT" })
  })

  it("soft-deletes: hidden from lists and candidate sets, NOT_FOUND on read", async () => {
    const db = testDb()
    await insertPatient(
      db,
      patient({ id: "pat_c", listing: { state: "active" } }),
      actor
    )
    await softDeletePatient(db, "pat_c", actor)
    expect((await listPatients(db, {})).items).toHaveLength(0)
    expect(await activePatients(db)).toHaveLength(0)
    await expect(getPatient(db, "pat_c")).rejects.toBeInstanceOf(AppError)
  })

  it("paginates by keyset without gaps or duplicates", async () => {
    const db = testDb()
    for (let i = 0; i < 7; i++)
      await insertPatient(db, patient({ id: `pat_${i}` }), actor)
    const seen: string[] = []
    let cursor: string | undefined
    do {
      const page = await listPatients(db, { cursor, limit: 3 })
      seen.push(...page.items.map((r) => r.id))
      cursor = page.nextCursor ?? undefined
    } while (cursor)
    expect(new Set(seen).size).toBe(7)
  })

  it("deduplicates snapshots by content", async () => {
    const db = testDb()
    const p = patient({ id: "pat_s" })
    const [a, b] = await putSnapshots(db, [
      { kind: "patient", data: p },
      { kind: "patient", data: structuredClone(p) },
    ])
    expect(a).toBe(b)
  })
})

describe("donors repository", () => {
  beforeEach(resetTestDb)
  afterAll(closeTestDb)
  const actor = "Dr Ada Okafor"

  it("rejects a stale version with CONFLICT", async () => {
    const db = testDb()
    const d = donor({ id: "don_b" })
    await insertDonor(db, d, actor)
    const updated = await updateDonor(db, { ...d, notes: "one" }, 1, actor)
    expect(updated.version).toBe(2)
    await expect(
      updateDonor(db, { ...d, notes: "two" }, 1, actor)
    ).rejects.toMatchObject({ code: "CONFLICT" })
  })

  it("soft-deletes: hidden from candidate sets, NOT_FOUND on read", async () => {
    const db = testDb()
    await insertDonor(
      db,
      donor({ id: "don_c", identity: { state: "available" } }),
      actor
    )
    expect(await availableDonors(db)).toHaveLength(1)
    await softDeleteDonor(db, "don_c", actor)
    expect(await availableDonors(db)).toHaveLength(0)
    await expect(getDonor(db, "don_c")).rejects.toMatchObject({
      code: "NOT_FOUND",
    })
  })
})
