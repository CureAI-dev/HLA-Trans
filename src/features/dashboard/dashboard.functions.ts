import { createServerFn } from "@tanstack/react-start"
import { readMiddleware } from "@/features/shared/middleware"
import { getDb } from "@/server/db/client.server"
import { dashboardSummary } from "@/server/repos/dashboard.server"

export const dashboardFn = createServerFn({ method: "GET" })
  .middleware([readMiddleware])
  .handler(() => dashboardSummary(getDb()))
