import { queryOptions } from "@tanstack/react-query"
import { getMatchFn, listMatchesFn } from "./matches.functions"
import type { MatchListSearch } from "./matches.functions"

export const matchKeys = {
  all: ["matches"] as const,
  lists: () => [...matchKeys.all, "list"] as const,
  list: (search: MatchListSearch) => [...matchKeys.lists(), search] as const,
  detail: (id: string) => [...matchKeys.all, "detail", id] as const,
}

export const matchQueries = {
  list: (search: MatchListSearch) =>
    queryOptions({
      queryKey: matchKeys.list(search),
      queryFn: () => listMatchesFn({ data: search }),
    }),
  // Saved results are immutable except for decision and out-of-date flags: long staleTime.
  detail: (id: string) =>
    queryOptions({
      queryKey: matchKeys.detail(id),
      queryFn: () => getMatchFn({ data: { id } }),
      staleTime: 60_000,
    }),
}
