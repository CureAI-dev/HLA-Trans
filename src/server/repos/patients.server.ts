import { and, asc, desc, eq, ilike, isNull, or, sql } from "drizzle-orm"
import { patients } from "../db/schema.server"
import type { Executor } from "../db/client.server"
import { appendAudit } from "./audit.server"
import { after, first, likeContains, parseCursor, toPage } from "./sql.server"
import { snapshotHash } from "./snapshots.server"
import { patientSchema } from "@/domain/schema"
import type { Patient } from "@/domain/schema"
import type { PatientRow, Versioned } from "@/domain/match-types"
import { AppError } from "@/lib/app-error"
import type { Page } from "@/lib/cursor"

export type PatientSort = "updated" | "name" | "listed"
export type PatientListInput = {
  q?: string
  state?: Patient["listing"]["state"]
  abo?: NonNullable<Patient["blood"]["abo"]>
  urgency?: NonNullable<Patient["listing"]["urgencyStatus"]>
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
  const q = input.q?.trim()
  const rows = await exec
    .select(rowSelect)
    .from(patients)
    .where(
      and(
        isNull(patients.deletedAt),
        input.state ? eq(patients.listingState, input.state) : undefined,
        input.abo ? eq(patients.abo, input.abo) : undefined,
        input.urgency ? eq(patients.urgencyStatus, input.urgency) : undefined,
        q
          ? or(
              ilike(patients.fullName, likeContains(q)),
              ilike(patients.mrn, likeContains(q))
            )
          : undefined,
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
