import { and, asc, count, desc, eq, ilike, isNull, or, sql } from "drizzle-orm"
import type { SQL } from "drizzle-orm"
import { donors } from "../db/schema.server"
import type { Executor } from "../db/client.server"
import { appendAudit } from "./audit.server"
import { latestCriterion } from "./criteria.server"
import { after, first, likeContains, parseCursor, toPage } from "./sql.server"
import { snapshotHash } from "./snapshots.server"
import { donorSchema } from "@/domain/schema"
import type { Donor } from "@/domain/schema"
import type { DonorRow, Versioned } from "@/domain/match-types"
import { AppError } from "@/lib/app-error"
import type { Page } from "@/lib/cursor"

export type DonorSort = "updated" | "code"
export type DonorFilter = {
  q?: string
  state?: Donor["identity"]["state"]
  abo?: NonNullable<Donor["blood"]["abo"]>
  donationType?: Donor["donation"]["type"]
}
export type DonorListInput = DonorFilter & {
  sort?: DonorSort
  cursor?: string
  limit?: number
}

export function donorCols(d: Donor) {
  return {
    donorCode: d.identity.donorId,
    state: d.identity.state,
    abo: d.blood.abo,
    donationType: d.donation.type,
    ageYears:
      d.identity.ageYears === null ? null : Math.floor(d.identity.ageYears),
    hospital: d.identity.donorHospital,
    contentHash: snapshotHash(d),
  }
}

const rowSelect = {
  id: donors.id,
  version: donors.version,
  donorCode: donors.donorCode,
  state: donors.state,
  abo: donors.abo,
  donationType: donors.donationType,
  ageYears: donors.ageYears,
  hospital: donors.hospital,
  updatedAt: donors.updatedAt,
}

/** One WHERE for the list and its counts, so the tiles and the table cannot disagree. */
function donorWhere(input: DonorFilter): Array<SQL | undefined> {
  const q = input.q?.trim()
  return [
    isNull(donors.deletedAt),
    input.state ? eq(donors.state, input.state) : undefined,
    input.abo ? eq(donors.abo, input.abo) : undefined,
    input.donationType
      ? eq(donors.donationType, input.donationType)
      : undefined,
    q
      ? or(
          ilike(donors.donorCode, likeContains(q)),
          ilike(donors.hospital, likeContains(q))
        )
      : undefined,
  ]
}

export type DonorStats = {
  total: number
  available: number
  allocated: number
  dcd: number
  /** Median donor age in years; null when no donor has an age. */
  medianAge: number | null
  /** Donors at or above the latest criteria's age review threshold. */
  ageReview: number
  ageReviewAbove: number
}

/** KPI counts over every donor matching the filter (not one page). */
export async function donorStats(
  exec: Executor,
  input: DonorFilter
): Promise<DonorStats> {
  const reviewAge = latestCriterion("donor", "ageReviewAbove")
  const [row] = await exec
    .select({
      total: count(),
      available:
        sql<number>`count(*) filter (where ${donors.state} = 'available')`.mapWith(
          Number
        ),
      allocated:
        sql<number>`count(*) filter (where ${donors.state} = 'allocated')`.mapWith(
          Number
        ),
      dcd: sql<number>`count(*) filter (where ${donors.donationType} = 'dcd')`.mapWith(
        Number
      ),
      medianAge: sql<
        number | null
      >`percentile_cont(0.5) within group (order by ${donors.ageYears})`,
      ageReview:
        sql<number>`count(*) filter (where ${donors.ageYears} >= ${reviewAge})`.mapWith(
          Number
        ),
      ageReviewAbove: reviewAge.mapWith(Number),
    })
    .from(donors)
    .where(and(...donorWhere(input)))
  return {
    ...row,
    medianAge: row.medianAge === null ? null : Number(row.medianAge),
  }
}

export async function listDonors(
  exec: Executor,
  input: DonorListInput
): Promise<Page<DonorRow>> {
  const limit = Math.min(input.limit ?? 50, 200)
  const sort = input.sort ?? "updated"
  const cursor = parseCursor(input.cursor)
  const key = sort === "code" ? donors.donorCode : donors.updatedAt
  const keyType = sort === "code" ? "text" : "timestamptz"
  const dir = sort === "code" ? "asc" : "desc"
  const rows = await exec
    .select(rowSelect)
    .from(donors)
    .where(
      and(
        ...donorWhere(input),
        cursor ? after(key, donors.id, cursor, dir, keyType) : undefined
      )
    )
    .orderBy(
      ...(dir === "asc"
        ? [asc(key), asc(donors.id)]
        : [desc(key), desc(donors.id)])
    )
    .limit(limit + 1)
  const items = rows.map((r) => ({
    ...r,
    updatedAt: r.updatedAt.toISOString(),
  })) as DonorRow[]
  return toPage(items, limit, (r) => ({
    k: sort === "code" ? r.donorCode : r.updatedAt,
    id: r.id,
  }))
}

export async function getDonor(
  exec: Executor,
  id: string
): Promise<Versioned<Donor>> {
  const row = first(
    await exec
      .select({ data: donors.data, version: donors.version })
      .from(donors)
      .where(and(eq(donors.id, id), isNull(donors.deletedAt)))
  )
  if (!row)
    throw new AppError(
      "NOT_FOUND",
      "Donor not found. It may have been deleted."
    )
  return { record: row.data, version: row.version }
}

export async function insertDonor(
  exec: Executor,
  input: Donor,
  actor: string
): Promise<Versioned<Donor>> {
  const now = new Date()
  const record = donorSchema.parse({
    ...input,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  })
  await exec.insert(donors).values({
    id: record.id,
    version: 1,
    ...donorCols(record),
    data: record,
    createdAt: now,
    updatedAt: now,
  })
  await appendAudit(exec, {
    actor,
    action: "donor.created",
    subjectId: record.id,
    summary: "Created donor record",
    at: now,
  })
  return { record, version: 1 }
}

export async function updateDonor(
  exec: Executor,
  input: Donor,
  expectedVersion: number,
  actor: string
): Promise<Versioned<Donor>> {
  const now = new Date()
  const record = donorSchema.parse({ ...input, updatedAt: now.toISOString() })
  const row = first(
    await exec
      .update(donors)
      .set({
        ...donorCols(record),
        data: record,
        version: sql`${donors.version} + 1`,
        updatedAt: now,
      })
      .where(
        and(
          eq(donors.id, record.id),
          eq(donors.version, expectedVersion),
          isNull(donors.deletedAt)
        )
      )
      .returning({ version: donors.version })
  )
  if (!row) {
    await getDonor(exec, record.id)
    throw new AppError(
      "CONFLICT",
      "This donor changed since you opened it. Reload to see the latest version."
    )
  }
  await appendAudit(exec, {
    actor,
    action: "donor.updated",
    subjectId: record.id,
    summary: "Updated donor record",
    at: now,
  })
  return { record, version: row.version }
}

export async function softDeleteDonor(
  exec: Executor,
  id: string,
  actor: string
): Promise<void> {
  const now = new Date()
  const row = first(
    await exec
      .update(donors)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(donors.id, id), isNull(donors.deletedAt)))
      .returning({ id: donors.id })
  )
  if (!row)
    throw new AppError(
      "NOT_FOUND",
      "Donor not found. It may have been deleted."
    )
  await appendAudit(exec, {
    actor,
    action: "donor.deleted",
    subjectId: id,
    summary: "Deleted donor; match results retained",
    at: now,
  })
}

export async function availableDonors(exec: Executor): Promise<Donor[]> {
  const rows = await exec
    .select({ data: donors.data })
    .from(donors)
    .where(and(eq(donors.state, "available"), isNull(donors.deletedAt)))
  return rows.map((r) => r.data)
}
