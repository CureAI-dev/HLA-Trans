import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { closeTestDb, resetTestDb, testDb } from "../../db/test-db.server"
import {
  insertPatient,
  listPatients,
  patientStats,
  softDeletePatient,
} from "../patients.server"
import { donorStats, insertDonor, listDonors } from "../donors.server"
import { donor, patient } from "@/domain/__tests__/builders"

const actor = "Dr Ada Okafor"

describe("patient list stats", () => {
  beforeEach(resetTestDb)
  afterAll(closeTestDb)

  async function seed() {
    const db = testDb()
    const rows = [
      {
        id: "pat_1",
        state: "active",
        urgency: "A1",
        device: "va_ecmo",
        cpra: 0,
        listed: "2026-11-12",
        abo: "O",
      },
      {
        id: "pat_2",
        state: "active",
        urgency: "A3",
        device: "none",
        cpra: 40,
        listed: "2026-11-02",
        abo: "A",
      },
      {
        id: "pat_3",
        state: "active",
        urgency: "P1A",
        device: "none",
        cpra: 10,
        listed: "2026-10-23",
        abo: "O",
      },
      {
        id: "pat_4",
        state: "inactive",
        urgency: "A6",
        device: "lvad_durable",
        cpra: 80,
        listed: "2026-01-01",
        abo: "O",
      },
    ] as const
    for (const r of rows)
      await insertPatient(
        db,
        patient({
          id: r.id,
          identity: { mrn: r.id },
          listing: {
            state: r.state,
            urgencyStatus: r.urgency,
            listingDate: r.listed,
          },
          support: { device: r.device },
          sensitization: { cpra: r.cpra },
          blood: { abo: r.abo },
        }),
        actor
      )
    return db
  }

  it("counts every matching record and follows the filters", async () => {
    const db = await seed()
    const all = await patientStats(db, {}, "2026-11-22")
    expect(all).toEqual({
      total: 4,
      active: 3,
      highUrgency: 2,
      onMcs: 2,
      sensitized: 2, // cPRA strictly above the default 10%
      sensitizedMin: 10,
      medianWaitDays: 20, // active only: 10, 20, 30 days
    })
    const groupO = await patientStats(db, { abo: "O" }, "2026-11-22")
    expect(groupO).toMatchObject({
      total: 3,
      active: 2,
      highUrgency: 2,
      onMcs: 2,
      sensitized: 1,
    })
  })

  it("uses the same filter for the list as for the counts", async () => {
    const db = await seed()
    for (const flag of ["urgent", "mcs", "sensitized"] as const) {
      const [stats, page] = await Promise.all([
        patientStats(db, { flag }),
        listPatients(db, { flag }),
      ])
      expect(page.items).toHaveLength(stats.total)
    }
    expect(
      (await listPatients(db, { flag: "mcs" })).items.map((r) => r.id).sort()
    ).toEqual(["pat_1", "pat_4"])
  })

  it("skips deleted records and returns null median when nobody is active", async () => {
    const db = await seed()
    for (const id of ["pat_1", "pat_2", "pat_3"])
      await softDeletePatient(db, id, actor)
    const stats = await patientStats(db, {}, "2026-11-22")
    expect(stats).toMatchObject({ total: 1, active: 0, medianWaitDays: null })
  })
})

describe("donor list stats", () => {
  beforeEach(resetTestDb)
  afterAll(closeTestDb)

  it("counts state, DCD and age over the filtered set", async () => {
    const db = testDb()
    const rows = [
      { id: "don_1", state: "available", type: "dbd", age: 30, abo: "O" },
      { id: "don_2", state: "available", type: "dcd", age: 50, abo: "A" },
      { id: "don_3", state: "allocated", type: "dbd", age: 45, abo: "O" },
    ] as const
    for (const r of rows)
      await insertDonor(
        db,
        donor({
          id: r.id,
          identity: { donorId: r.id, state: r.state, ageYears: r.age },
          donation: { type: r.type },
          blood: { abo: r.abo },
        }),
        actor
      )
    expect(await donorStats(db, {})).toEqual({
      total: 3,
      available: 2,
      allocated: 1,
      dcd: 1,
      medianAge: 45,
      ageReview: 2,
      ageReviewAbove: 45,
    })
    const stats = await donorStats(db, { abo: "O" })
    expect(stats).toMatchObject({ total: 2, dcd: 0, medianAge: 37.5 })
    expect((await listDonors(db, { abo: "O" })).items).toHaveLength(stats.total)
  })
})
