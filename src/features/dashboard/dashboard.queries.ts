import { queryOptions } from "@tanstack/react-query"
import { dashboardFn } from "./dashboard.functions"

export const dashboardKeys = { all: ["dashboard"] as const }

export const dashboardQueries = {
  summary: () =>
    queryOptions({ queryKey: dashboardKeys.all, queryFn: () => dashboardFn() }),
}
