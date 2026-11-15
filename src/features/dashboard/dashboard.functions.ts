import { createServerFn } from "@tanstack/react-start"
import { errorMiddleware } from "@/features/shared/middleware"
import { getDb } from "@/server/db/client.server"
import { dashboardSummary } from "@/server/repos/dashboard.server"

export const dashboardFn = createServerFn({ method: "GET" })
  .middleware([errorMiddleware])
  .handler(() => dashboardSummary(getDb()))
