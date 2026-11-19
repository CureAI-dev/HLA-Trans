import { and, desc, eq, inArray, sql } from "drizzle-orm"
import { criteriaVersions, matchResults, matchRuns } from "../db/schema.server"
import type { Executor } from "../db/client.server"
import { appendAudit } from "./audit.server"
import { latestCriteria } from "./criteria.server"
import { after, first, parseCursor, toPage } from "./sql.server"
import { workerScope } from "../scope.server"
import { newId } from "@/domain/factories"
import type { RunRow, RunStatus, RunTrigger } from "@/domain/match-types"
import { AppError } from "@/lib/app-error"
import type { Page } from "@/lib/cursor"

export const MAX_ATTEMPTS = 3
export const STALE_AFTER_MS = 60_000
export const NOTIFY_CHANNEL = "match_runs"

/**
 * Tells a worker a run is ready. Under Bun: pg_notify, delivered on COMMIT only.
 * On Cloudflare Workers (Hyperdrive has no NOTIFY): the id is sent to the MATCH_RUNS
 * queue when the invocation ends. If the transaction rolled back, the message is a
 * harmless spurious wake-up, because consumers claim whatever is queued, not this id.
 */
async function wakeWorker(exec: Executor, runId: string): Promise<void> {
  const scope = workerScope.getStore()
  if (scope) scope.wake.add(runId)
  else await exec.execute(sql`select pg_notify(${NOTIFY_CHANNEL}, ${runId})`)
}

export type EnqueueInput = {
  subjectKind: "patient" | "donor"
  subjectId: string
  subjectLabel: string
  trigger: RunTrigger
  actor: string
}

/** Call inside the same transaction that writes the subject (transactional outbox). */
export async function enqueueRun(
  exec: Executor,
  input: EnqueueInput
): Promise<string> {
  const criteria = await latestCriteria(exec)
  const id = newId("run")
  const now = new Date()
  await exec.insert(matchRuns).values({
    id,
    trigger: input.trigger,
    subjectKind: input.subjectKind,
    subjectId: input.subjectId,
    subjectLabel: input.subjectLabel,
    criteriaVersionId: criteria.id,
    status: "queued",
    createdBy: input.actor,
    createdAt: now,
  })
  await appendAudit(exec, {
    actor: input.actor,
    action: "match_run.queued",
    subjectId: id,
    summary: `Queued matching for ${input.subjectLabel}`,
    at: now,
  })
  await wakeWorker(exec, id)
  return id
}

/** Atomic claim; safe with any number of workers. */
export async function claimNextRun(exec: Executor): Promise<string | null> {
  const now = new Date()
  const result = await exec.execute<{ id: string }>(sql`
    update ${matchRuns}
       set status = 'running', started_at = coalesce(started_at, ${now}), heartbeat_at = ${now}, attempts = attempts + 1
     where id = (
       select id from ${matchRuns}
        where status = 'queued'
        order by created_at, id
        for update skip locked
        limit 1)
    returning id`)
  return result.rows[0]?.id ?? null
}

export async function finishRun(
  exec: Executor,
  runId: string,
  status: "succeeded" | "failed" | "cancelled",
  error: string | null,
  actor = "System"
): Promise<void> {
  const now = new Date()
  const counts = (o: string) =>
    sql`(select count(*)::int from ${matchResults} where run_id = ${runId} and overall = ${o})`
  const row = first(
    await exec
      .update(matchRuns)
      .set({
        status,
        error,
        finishedAt: now,
        passCount: counts("pass"),
        reviewCount: counts("review"),
        failCount: counts("fail"),
        processed: sql`(select count(*)::int from ${matchResults} where run_id = ${runId})`,
      })
      .where(
        and(
          eq(matchRuns.id, runId),
          inArray(matchRuns.status, ["queued", "running"])
        )
      )
      .returning({ label: matchRuns.subjectLabel })
  )
  if (row)
    await appendAudit(exec, {
      actor,
      action: `match_run.${status}`,
      subjectId: runId,
      summary: `Matching ${status} for ${row.label}${error ? `: ${error}` : ""}`,
      at: now,
    })
}

/** Graceful shutdown: hand the run back without spending an attempt. */
export async function releaseRun(exec: Executor, runId: string): Promise<void> {
  await exec.execute(
    sql`update ${matchRuns} set status = 'queued', attempts = greatest(attempts - 1, 0) where id = ${runId} and status = 'running'`
  )
  await wakeWorker(exec, runId)
}

export async function failOrRequeue(
  exec: Executor,
  runId: string,
  error: unknown
): Promise<void> {
  const message =
    error instanceof Error
      ? error.message.slice(0, 500)
      : "Unknown worker error"
  const run = first(
    await exec
      .select({ attempts: matchRuns.attempts })
      .from(matchRuns)
      .where(eq(matchRuns.id, runId))
  )
  if (!run) return
  if (run.attempts >= MAX_ATTEMPTS)
    await finishRun(exec, runId, "failed", message)
  else {
    await exec
      .update(matchRuns)
      .set({ status: "queued", error: message })
      .where(and(eq(matchRuns.id, runId), eq(matchRuns.status, "running")))
    await wakeWorker(exec, runId)
  }
}

/** Runs whose worker died. Requeue until MAX_ATTEMPTS, then fail. Returns rows touched. */
export async function reapStaleRuns(
  exec: Executor,
  now = new Date()
): Promise<number> {
  const staleBefore = new Date(now.getTime() - STALE_AFTER_MS)
  const result = await exec.execute<{ id: string; status: string }>(sql`
    update ${matchRuns}
       set status = case when attempts >= ${MAX_ATTEMPTS} then 'failed' else 'queued' end,
           error = case when attempts >= ${MAX_ATTEMPTS} then 'The worker stopped responding repeatedly.' else error end,
           finished_at = case when attempts >= ${MAX_ATTEMPTS} then ${now}::timestamptz else null end
     where status = 'running' and heartbeat_at < ${staleBefore}
    returning id, status`)
  for (const row of result.rows) {
    if (row.status === "queued") await wakeWorker(exec, row.id)
    else
      await appendAudit(exec, {
        actor: "System",
        action: "match_run.failed",
        subjectId: row.id,
        summary: "Matching failed: worker stopped responding",
        at: now,
      })
  }
  return result.rows.length
}

export async function requestCancel(
  exec: Executor,
  runId: string,
  actor: string
): Promise<RunStatus> {
  const now = new Date()
  const result = await exec.execute<{ status: RunStatus; label: string }>(sql`
    update ${matchRuns}
       set cancel_requested = true,
           status = case when status = 'queued' then 'cancelled' else status end,
           finished_at = case when status = 'queued' then ${now} else finished_at end
     where id = ${runId} and status in ('queued', 'running')
    returning status, subject_label as label`)
  const row = first(result.rows)
  if (!row) {
    await getRun(exec, runId) // NOT_FOUND if missing
    throw new AppError("CONFLICT", "This run has already finished.")
  }
  if (row.status === "cancelled")
    await appendAudit(exec, {
      actor,
      action: "match_run.cancelled",
      subjectId: runId,
      summary: `Cancelled matching for ${row.label}`,
      at: now,
    })
  return row.status
}

const runSelect = {
  id: matchRuns.id,
  trigger: matchRuns.trigger,
  subjectKind: matchRuns.subjectKind,
  subjectId: matchRuns.subjectId,
  subjectLabel: matchRuns.subjectLabel,
  criteriaVersion: criteriaVersions.version,
  status: matchRuns.status,
  total: matchRuns.total,
  processed: matchRuns.processed,
  passCount: matchRuns.passCount,
  reviewCount: matchRuns.reviewCount,
  failCount: matchRuns.failCount,
  error: matchRuns.error,
  cancelRequested: matchRuns.cancelRequested,
  createdBy: matchRuns.createdBy,
  createdAt: matchRuns.createdAt,
  startedAt: matchRuns.startedAt,
  finishedAt: matchRuns.finishedAt,
}
type RawRun = {
  createdAt: Date
  startedAt: Date | null
  finishedAt: Date | null
} & Omit<RunRow, "createdAt" | "startedAt" | "finishedAt">
const toRunRow = (r: RawRun): RunRow => ({
  ...r,
  createdAt: r.createdAt.toISOString(),
  startedAt: r.startedAt?.toISOString() ?? null,
  finishedAt: r.finishedAt?.toISOString() ?? null,
})

export async function listActiveRuns(exec: Executor): Promise<RunRow[]> {
  const rows = await exec
    .select(runSelect)
    .from(matchRuns)
    .innerJoin(
      criteriaVersions,
      eq(criteriaVersions.id, matchRuns.criteriaVersionId)
    )
    .where(inArray(matchRuns.status, ["queued", "running"]))
    .orderBy(matchRuns.createdAt)
  return rows.map(toRunRow)
}

export type RunHistoryInput = {
  status?: RunStatus
  subjectKind?: "patient" | "donor"
  subjectId?: string
  cursor?: string
  limit?: number
}

export async function listRunHistory(
  exec: Executor,
  input: RunHistoryInput
): Promise<Page<RunRow>> {
  const limit = Math.min(input.limit ?? 50, 200)
  const cursor = parseCursor(input.cursor)
  const rows = await exec
    .select(runSelect)
    .from(matchRuns)
    .innerJoin(
      criteriaVersions,
      eq(criteriaVersions.id, matchRuns.criteriaVersionId)
    )
    .where(
      and(
        input.status ? eq(matchRuns.status, input.status) : undefined,
        input.subjectKind
          ? eq(matchRuns.subjectKind, input.subjectKind)
          : undefined,
        input.subjectId ? eq(matchRuns.subjectId, input.subjectId) : undefined,
        cursor
          ? after(
              matchRuns.createdAt,
              matchRuns.id,
              cursor,
              "desc",
              "timestamptz"
            )
          : undefined
      )
    )
    .orderBy(desc(matchRuns.createdAt), desc(matchRuns.id))
    .limit(limit + 1)
  return toPage(rows.map(toRunRow), limit, (r) => ({
    k: r.createdAt,
    id: r.id,
  }))
}

export async function getRun(exec: Executor, id: string): Promise<RunRow> {
  const row = first(
    await exec
      .select(runSelect)
      .from(matchRuns)
      .innerJoin(
        criteriaVersions,
        eq(criteriaVersions.id, matchRuns.criteriaVersionId)
      )
      .where(eq(matchRuns.id, id))
  )
  if (!row) throw new AppError("NOT_FOUND", "Match run not found.")
  return toRunRow(row)
}
