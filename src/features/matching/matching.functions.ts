import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { errorMiddleware, writeMiddleware } from "@/features/shared/middleware"
import { getDb } from "@/server/db/client.server"
import {
  getRun,
  listActiveRuns,
  listRunHistory,
  requestCancel,
} from "@/server/repos/runs.server"

export const runHistorySearch = z.object({
  status: z
    .enum(["queued", "running", "succeeded", "failed", "cancelled"])
    .optional()
    .catch(undefined),
  subjectKind: z.enum(["patient", "donor"]).optional().catch(undefined),
  subjectId: z.string().max(64).optional().catch(undefined),
  cursor: z.string().max(600).optional().catch(undefined),
})
export type RunHistorySearch = z.infer<typeof runHistorySearch>
const idInput = z.object({ id: z.string().min(1).max(64) })

export const activeRunsFn = createServerFn({ method: "GET" })
  .middleware([errorMiddleware])
  .handler(() => listActiveRuns(getDb()))

export const runHistoryFn = createServerFn({ method: "GET" })
  .middleware([errorMiddleware])
  .validator(runHistorySearch)
  .handler(({ data }) => listRunHistory(getDb(), data))

export const getRunFn = createServerFn({ method: "GET" })
  .middleware([errorMiddleware])
  .validator(idInput)
  .handler(({ data }) => getRun(getDb(), data.id))

export const cancelRunFn = createServerFn({ method: "POST" })
  .middleware([writeMiddleware])
  .validator(idInput)
  .handler(({ data, context }) => requestCancel(getDb(), data.id, context.actor))
