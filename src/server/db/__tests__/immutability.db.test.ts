import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { eq, sql } from "drizzle-orm"
import { auditLog, criteriaVersions } from "../schema.server"
import { closeTestDb, resetTestDb, testDb } from "../test-db.server"
import { DEFAULT_CRITERIA } from "@/domain/criteria"

const at = new Date("2026-11-14T12:00:00.000Z")
/** Drizzle wraps driver errors in DrizzleQueryError; the trigger's message is on `cause`. */
const appendOnly = {
  cause: expect.objectContaining({
    message: expect.stringMatching(/append-only/),
  }),
}

describe("append-only tables", () => {
  beforeEach(resetTestDb)
  afterAll(closeTestDb)

  it("rejects UPDATE and DELETE on audit_log", async () => {
    const db = testDb()
    await db.insert(auditLog).values({
      id: "aud_1",
      at,
      actor: "Dr Test",
      action: "data.seeded",
      subjectId: "x",
      summary: "s",
    })
    await expect(
      db
        .update(auditLog)
        .set({ summary: "changed" })
        .where(eq(auditLog.id, "aud_1"))
    ).rejects.toMatchObject(appendOnly)
    await expect(
      db.delete(auditLog).where(eq(auditLog.id, "aud_1"))
    ).rejects.toMatchObject(appendOnly)
  })

  it("rejects UPDATE on criteria_versions", async () => {
    const db = testDb()
    await db.insert(criteriaVersions).values({
      id: "crv_1",
      version: 1,
      author: "System",
      changeNote: "init",
      criteria: DEFAULT_CRITERIA,
      createdAt: at,
    })
    await expect(
      db
        .update(criteriaVersions)
        .set({ changeNote: "x" })
        .where(eq(criteriaVersions.id, "crv_1"))
    ).rejects.toMatchObject(appendOnly)
  })

  it("allows TRUNCATE for reset", async () => {
    await testDb().execute(sql`TRUNCATE audit_log`)
  })
})
