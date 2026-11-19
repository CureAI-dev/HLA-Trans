import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { readMiddleware, writeMiddleware } from "@/features/shared/middleware"
import { criteriaSchema } from "@/domain/schema"
import { getDb } from "@/server/db/client.server"
import {
  latestCriteria,
  listCriteriaVersions,
  publishCriteria,
} from "@/server/repos/criteria.server"

export const latestCriteriaFn = createServerFn({ method: "GET" })
  .middleware([readMiddleware])
  .handler(() => latestCriteria(getDb()))

export const criteriaVersionsFn = createServerFn({ method: "GET" })
  .middleware([readMiddleware])
  .handler(() => listCriteriaVersions(getDb()))

export const publishCriteriaFn = createServerFn({ method: "POST" })
  .middleware([writeMiddleware])
  .validator(
    z.object({
      criteria: criteriaSchema,
      changeNote: z.string().trim().min(1, "Describe the change.").max(4000),
    })
  )
  .handler(({ data, context }) =>
    getDb().transaction((tx) =>
      publishCriteria(tx, data.criteria, data.changeNote, context.actor)
    )
  )
