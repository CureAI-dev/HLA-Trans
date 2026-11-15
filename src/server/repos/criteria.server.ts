import { desc, eq } from "drizzle-orm"
import { criteriaVersions } from "../db/schema.server"
import type { Executor } from "../db/client.server"
import { appendAudit } from "./audit.server"
import { first } from "./sql.server"
import { DEFAULT_CRITERIA, validateCriteria } from "@/domain/criteria"
import { criteriaSchema } from "@/domain/schema"
import type { Criteria, CriteriaVersion } from "@/domain/schema"
import { newId } from "@/domain/factories"
import { AppError } from "@/lib/app-error"

type Row = typeof criteriaVersions.$inferSelect
const toVersion = (r: Row): CriteriaVersion => ({
  id: r.id,
  version: r.version,
  createdAt: r.createdAt.toISOString(),
  author: r.author,
  changeNote: r.changeNote,
  criteria: r.criteria,
})

export async function ensureInitialCriteria(exec: Executor): Promise<void> {
  await exec
    .insert(criteriaVersions)
    .values({
      id: "criteria-v1",
      version: 1,
      author: "System",
      changeNote: "Initial default criteria",
      criteria: structuredClone(DEFAULT_CRITERIA),
      createdAt: new Date(),
    })
    .onConflictDoNothing()
}

export async function latestCriteria(exec: Executor): Promise<CriteriaVersion> {
  const row = first(
    await exec
      .select()
      .from(criteriaVersions)
      .orderBy(desc(criteriaVersions.version))
      .limit(1)
  )
  if (row) return toVersion(row)
  await ensureInitialCriteria(exec)
  return latestCriteria(exec)
}

export async function getCriteriaVersion(
  exec: Executor,
  id: string
): Promise<CriteriaVersion> {
  const row = first(
    await exec
      .select()
      .from(criteriaVersions)
      .where(eq(criteriaVersions.id, id))
  )
  if (!row) throw new AppError("NOT_FOUND", "Criteria version not found.")
  return toVersion(row)
}

export async function listCriteriaVersions(
  exec: Executor
): Promise<CriteriaVersion[]> {
  const rows = await exec
    .select()
    .from(criteriaVersions)
    .orderBy(desc(criteriaVersions.version))
  return rows.map(toVersion)
}

/** Concurrent publishes race on UNIQUE(version); the loser gets CONFLICT via toAppError. */
export async function publishCriteria(
  exec: Executor,
  input: Criteria,
  changeNote: string,
  actor: string
): Promise<CriteriaVersion> {
  const criteria = criteriaSchema.parse(input)
  const issues = validateCriteria(criteria)
  if (issues.length)
    throw new AppError(
      "VALIDATION",
      "Criteria are inconsistent.",
      Object.fromEntries(issues.map((i) => [i.path, i.message]))
    )
  const latest = await latestCriteria(exec)
  const now = new Date()
  const [row] = await exec
    .insert(criteriaVersions)
    .values({
      id: newId("crv"),
      version: latest.version + 1,
      author: actor,
      changeNote,
      criteria,
      createdAt: now,
    })
    .returning()
  await appendAudit(exec, {
    actor,
    action: "criteria.published",
    subjectId: row.id,
    summary: `Published criteria version ${row.version}`,
    at: now,
  })
  return toVersion(row)
}
