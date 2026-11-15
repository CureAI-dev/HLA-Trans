import { queryOptions } from "@tanstack/react-query"
import { criteriaVersionsFn, latestCriteriaFn } from "./criteria.functions"

export const criteriaKeys = {
  all: ["criteria"] as const,
  latest: () => [...criteriaKeys.all, "latest"] as const,
  versions: () => [...criteriaKeys.all, "versions"] as const,
}

export const criteriaQueries = {
  latest: () =>
    queryOptions({
      queryKey: criteriaKeys.latest(),
      queryFn: () => latestCriteriaFn(),
    }),
  versions: () =>
    queryOptions({
      queryKey: criteriaKeys.versions(),
      queryFn: () => criteriaVersionsFn(),
    }),
}
