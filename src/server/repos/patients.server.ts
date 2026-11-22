import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  ne,
  or,
  sql,
} from "drizzle-orm"
import type { SQL } from "drizzle-orm"
import { patients } from "../db/schema.server"
import type { Executor } from "../db/client.server"
import { appendAudit } from "./audit.server"
import { latestCriterion } from "./criteria.server"
import { after, first, likeContains, parseCursor, toPage } from "./sql.server"
import { snapshotHash } from "./snapshots.server"
import { patientSchema } from "@/domain/schema"
import type { Patient } from "@/domain/schema"
import type { PatientRow, Versioned } from "@/domain/match-types"
import { AppError } from "@/lib/app-error"
import type { Page } from "@/lib/cursor"

export type PatientSort = "updated" | "name" | "listed"
/** Quick filters behind the list KPI tiles. */
export type PatientFlag = "urgent" | "mcs" | "sensitized"
export type PatientFilter = {
  q?: string
  state?: Patient["listing"]["state"]
  abo?: NonNullable<Patient["blood"]["abo"]>
  urgency?: NonNullable<Patient["listing"]["urgencyStatus"]>
  flag?: PatientFlag
}
export type PatientListInput = PatientFilter & {
  sort?: PatientSort
  cursor?: string
  limit?: number
}

/** Summary columns derived from the record. Shared with the importer: one definition. */
export function patientCols(p: Patient) {
  return {
    mrn: p.identity.mrn,
    fullName: `${p.identity.firstName} ${p.identity.lastName}`.trim(),
    sortName: `${p.identity.lastName} ${p.identity.firstName}`
      .trim()
      .toLowerCase(),
    dateOfBirth: p.identity.dateOfBirth,
    listingState: p.listing.state,
    listingDate: p.listing.listingDate,
    urgencyStatus: p.listing.urgencyStatus,
    abo: p.blood.abo,
    device: p.support.device,
    cpra: p.sensitization.cpra,
    contentHash: snapshotHash(p),
  }
}

const rowSelect = {
  id: patients.id,
  version: patients.version,
  mrn: patients.mrn,
  fullName: patients.fullName,
  dateOfBirth: patients.dateOfBirth,
  listingState: patients.listingState,
  listingDate: patients.listingDate,
  urgencyStatus: patients.urgencyStatus,
  abo: patients.abo,
  device: patients.device,
  cpra: patients.cpra,
  updatedAt: patients.updatedAt,
  sortName: patients.sortName,
}

/** Highest-urgency statuses: adult 1 and 2, pediatric 1A. */
export const HIGH_URGENCY = ["A1", "A2", "P1A"] as const

const flagCondition: Record<PatientFlag, () => SQL | undefined> = {
  urgent: () => inArray(patients.urgencyStatus, [...HIGH_URGENCY]),
  mcs: () => ne(patients.device, "none"),
  sensitized: () =>
    sql`${patients.cpra} > ${latestCriterion("immunology", "cpraSensitizedMin")}`,
}

/** One WHERE for the list and its counts, so the tiles and the table cannot disagree. */
function patientWhere(input: PatientFilter): Array<SQL | undefined> {
  const q = input.q?.trim()
  return [
    isNull(patients.deletedAt),
    input.state ? eq(patients.listingState, input.state) : undefined,
    input.abo ? eq(patients.abo, input.abo) : undefined,
    input.urgency ? eq(patients.urgencyStatus, input.urgency) : undefined,
    input.flag ? flagCondition[input.flag]() : undefined,
    q
      ? or(
          ilike(patients.fullName, likeContains(q)),
          ilike(patients.mrn, likeContains(q))
        )
      : undefined,
  ]
}

export type PatientStats = {
  total: number
  active: number
  highUrgency: number
  onMcs: number
  sensitized: number
  /** cPRA threshold (%) from the latest criteria version. */
  sensitizedMin: number
  /** Median days since listing among active patients; null when none. */
  medianWaitDays: number | null
}

/** KPI counts over every patient matching the filter (not one page). */
export async function patientStats(
  exec: Executor,
  input: PatientFilter,
  today: string = new Date().toISOString().slice(0, 10)
): Promise<PatientStats> {
  const cpraMin = latestCriterion("immunology", "cpraSensitizedMin")
  const active = sql`${patients.listingState} = 'active'`
  const [row] = await exec
    .select({
      total: count(),
      active: sql<number>`count(*) filter (where ${active})`.mapWith(Number),
      highUrgency:
        sql<number>`count(*) filter (where ${inArray(patients.urgencyStatus, [...HIGH_URGENCY])})`.mapWith(
          Number
        ),
      onMcs:
        sql<number>`count(*) filter (where ${patients.device} <> 'none')`.mapWith(
          Number
        ),
      sensitized:
        sql<number>`count(*) filter (where ${patients.cpra} > ${cpraMin})`.mapWith(
          Number
        ),
      sensitizedMin: cpraMin.mapWith(Number),
      medianWaitDays: sql<
        number | null
      >`percentile_cont(0.5) within group (order by ${today}::date - ${patients.listingDate}::date) filter (where ${active})`,
    })
    .from(patients)
    .where(and(...patientWhere(input)))
  return {
    ...row,
    medianWaitDays:
      row.medianWaitDays === null
        ? null
        : Math.round(Number(row.medianWaitDays)),
  }
}

export async function listPatients(
  exec: Executor,
  input: PatientListInput
): Promise<Page<PatientRow>> {
  const limit = Math.min(input.limit ?? 50, 200)
  const sort = input.sort ?? "updated"
  const cursor = parseCursor(input.cursor)
  const key =
    sort === "name"
      ? patients.sortName
      : sort === "listed"
        ? patients.listingDate
        : patients.updatedAt
  const keyType = sort === "updated" ? "timestamptz" : "text"
  const dir = sort === "name" ? "asc" : "desc"
  const order =
    dir === "asc"
      ? [asc(key), asc(patients.id)]
      : [desc(key), desc(patients.id)]
  const rows = await exec
    .select(rowSelect)
    .from(patients)
    .where(
      and(
        ...patientWhere(input),
        cursor ? after(key, patients.id, cursor, dir, keyType) : undefined
      )
    )
    .orderBy(...order)
    .limit(limit + 1)
  const items = rows.map(({ sortName, updatedAt, ...r }) => ({
    ...r,
    updatedAt: updatedAt.toISOString(),
    _k:
      sort === "name"
        ? sortName
        : sort === "listed"
          ? r.listingDate
          : updatedAt.toISOString(),
  })) as Array<PatientRow & { _k: string }>
  const page = toPage(items, limit, (r) => ({ k: r._k, id: r.id }))
  return { ...page, items: page.items.map(({ _k: _, ...r }) => r) }
}

export async function getPatient(
  exec: Executor,
  id: string
): Promise<Versioned<Patient>> {
  const row = first(
    await exec
      .select({ data: patients.data, version: patients.version })
      .from(patients)
      .where(and(eq(patients.id, id), isNull(patients.deletedAt)))
  )
  if (!row)
    throw new AppError(
      "NOT_FOUND",
      "Patient not found. It may have been deleted."
    )
  return { record: row.data, version: row.version }
}

export async function insertPatient(
  exec: Executor,
  input: Patient,
  actor: string
): Promise<Versioned<Patient>> {
  const now = new Date()
  const record = patientSchema.parse({
    ...input,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  })
  await exec.insert(patients).values({
    id: record.id,
    version: 1,
    ...patientCols(record),
    data: record,
    createdAt: now,
    updatedAt: now,
  })
  await appendAudit(exec, {
    actor,
    action: "patient.created",
    subjectId: record.id,
    summary: "Created patient record",
    at: now,
  })
  return { record, version: 1 }
}

export async function updatePatient(
  exec: Executor,
  input: Patient,
  expectedVersion: number,
  actor: string
): Promise<Versioned<Patient>> {
  const now = new Date()
  const record = patientSchema.parse({ ...input, updatedAt: now.toISOString() })
  const row = first(
    await exec
      .update(patients)
      .set({
        ...patientCols(record),
        data: record,
        version: sql`${patients.version} + 1`,
        updatedAt: now,
      })
      .where(
        and(
          eq(patients.id, record.id),
          eq(patients.version, expectedVersion),
          isNull(patients.deletedAt)
        )
      )
      .returning({ version: patients.version })
  )
  if (!row) {
    await getPatient(exec, record.id) // throws NOT_FOUND if gone
    throw new AppError(
      "CONFLICT",
      "This patient changed since you opened it. Reload to see the latest version."
    )
  }
  await appendAudit(exec, {
    actor,
    action: "patient.updated",
    subjectId: record.id,
    summary: "Updated patient record",
    at: now,
  })
  return { record, version: row.version }
}

export async function softDeletePatient(
  exec: Executor,
  id: string,
  actor: string
): Promise<void> {
  const now = new Date()
  const row = first(
    await exec
      .update(patients)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(patients.id, id), isNull(patients.deletedAt)))
      .returning({ id: patients.id })
  )
  if (!row)
    throw new AppError(
      "NOT_FOUND",
      "Patient not found. It may have been deleted."
    )
  await appendAudit(exec, {
    actor,
    action: "patient.deleted",
    subjectId: id,
    summary: "Deleted patient; match results retained",
    at: now,
  })
}

export async function activePatients(exec: Executor): Promise<Patient[]> {
  const rows = await exec
    .select({ data: patients.data })
    .from(patients)
    .where(and(eq(patients.listingState, "active"), isNull(patients.deletedAt)))
  return rows.map((r) => r.data)
}
