import { and, desc, eq } from "drizzle-orm"
import { auditLog } from "../db/schema.server"
import type { Executor } from "../db/client.server"
import { after, parseCursor, toPage } from "./sql.server"
import type { AuditAction } from "@/domain/match-types"
import { newId } from "@/domain/factories"
import type { Page } from "@/lib/cursor"

export type AuditInput = {
  actor: string
  action: AuditAction
  subjectId: string
  summary: string
  at?: Date
}
export type AuditRow = {
  id: string
  at: string
  actor: string
  action: string
  subjectId: string
  summary: string
}

export async function appendAudit(
  exec: Executor,
  entry: AuditInput
): Promise<void> {
  await exec.insert(auditLog).values({
    id: newId("aud"),
    at: entry.at ?? new Date(),
    actor: entry.actor || "Unspecified clinician",
    action: entry.action,
    subjectId: entry.subjectId,
    summary: entry.summary,
  })
}

export async function listAudit(
  exec: Executor,
  input: { action?: string; cursor?: string; limit?: number }
): Promise<Page<AuditRow>> {
  const limit = input.limit ?? 50
  const cursor = parseCursor(input.cursor)
  const rows = await exec
    .select()
    .from(auditLog)
    .where(
      and(
        input.action ? eq(auditLog.action, input.action) : undefined,
        cursor
          ? after(auditLog.at, auditLog.id, cursor, "desc", "timestamptz")
          : undefined
      )
    )
    .orderBy(desc(auditLog.at), desc(auditLog.id))
    .limit(limit + 1)
  const mapped = rows.map((r) => ({
    id: r.id,
    at: r.at.toISOString(),
    actor: r.actor,
    action: r.action,
    subjectId: r.subjectId,
    summary: r.summary,
  }))
  return toPage(mapped, limit, (r) => ({ k: r.at, id: r.id }))
}
