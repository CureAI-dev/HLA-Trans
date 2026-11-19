import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { readMiddleware } from "@/features/shared/middleware"
import { getDb } from "@/server/db/client.server"
import { listAudit } from "@/server/repos/audit.server"

export const auditSearch = z.object({
  action: z.string().max(40).optional().catch(undefined),
  cursor: z.string().max(600).optional().catch(undefined),
})
export type AuditSearch = z.infer<typeof auditSearch>

export const listAuditFn = createServerFn({ method: "GET" })
  .middleware([readMiddleware])
  .validator(auditSearch)
  .handler(({ data }) => listAudit(getDb(), data))
