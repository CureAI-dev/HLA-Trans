import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { errorMiddleware, writeMiddleware } from "@/features/shared/middleware"
import { decisionSchema, pairInputsSchema } from "@/domain/schema"
import { getDb } from "@/server/db/client.server"
import {
  checkPair,
  decideMatch,
  getMatch,
  listMatches,
} from "@/server/repos/matches.server"

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
export const matchListSearch = z.object({
  overall: z.enum(["pass", "review", "fail"]).optional().catch(undefined),
  decision: z.enum(["pending", "decided"]).optional().catch(undefined),
  source: z.enum(["screening", "checked"]).optional().catch(undefined),
  patientId: z.string().max(64).optional().catch(undefined),
  donorId: z.string().max(64).optional().catch(undefined),
  runId: z.string().max(64).optional().catch(undefined),
  from: isoDay.optional().catch(undefined),
  to: isoDay.optional().catch(undefined),
  order: z.enum(["recent", "screen"]).optional().catch(undefined),
  cursor: z.string().max(600).optional().catch(undefined),
})
export type MatchListSearch = z.infer<typeof matchListSearch>
const id64 = z.string().min(1).max(64)

export const listMatchesFn = createServerFn({ method: "GET" })
  .middleware([errorMiddleware])
  .validator(matchListSearch)
  .handler(({ data }) => listMatches(getDb(), data))

export const getMatchFn = createServerFn({ method: "GET" })
  .middleware([errorMiddleware])
  .validator(z.object({ id: id64 }))
  .handler(({ data }) => getMatch(getDb(), data.id))

export const checkPairFn = createServerFn({ method: "POST" })
  .middleware([writeMiddleware])
  .validator(
    z.object({ patientId: id64, donorId: id64, pair: pairInputsSchema })
  )
  .handler(({ data, context }) => checkPair(getDb(), data, context.actor))

export const decideMatchFn = createServerFn({ method: "POST" })
  .middleware([writeMiddleware])
  .validator(
    z.object({
      matchId: id64,
      decision: decisionSchema.omit({ decidedAt: true }),
    })
  )
  .handler(({ data, context }) =>
    decideMatch(getDb(), data.matchId, data.decision, context.actor)
  )
