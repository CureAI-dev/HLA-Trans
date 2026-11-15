import { and, count, eq, isNull } from "drizzle-orm"
import { decisions, donors, matchResults, patients } from "../db/schema.server"
import type { Executor } from "../db/client.server"
import { listMatches } from "./matches.server"
import type { MatchRow } from "@/domain/match-types"

export type DashboardSummary = {
  activePatients: number
  availableDonors: number
  pendingDecisions: number
  recent: MatchRow[]
  pending: MatchRow[]
}

export async function dashboardSummary(
  exec: Executor
): Promise<DashboardSummary> {
  const [a, b, c, recent, pending] = await Promise.all([
    exec
      .select({ n: count() })
      .from(patients)
      .where(
        and(eq(patients.listingState, "active"), isNull(patients.deletedAt))
      ),
    exec
      .select({ n: count() })
      .from(donors)
      .where(and(eq(donors.state, "available"), isNull(donors.deletedAt))),
    exec
      .select({ n: count() })
      .from(matchResults)
      .leftJoin(decisions, eq(decisions.matchId, matchResults.id))
      .where(and(eq(matchResults.source, "checked"), isNull(decisions.id))),
    listMatches(exec, { limit: 8 }),
    listMatches(exec, { source: "checked", decision: "pending", limit: 8 }),
  ])
  return {
    activePatients: a[0]?.n ?? 0,
    availableDonors: b[0]?.n ?? 0,
    pendingDecisions: c[0]?.n ?? 0,
    recent: recent.items,
    pending: pending.items,
  }
}
