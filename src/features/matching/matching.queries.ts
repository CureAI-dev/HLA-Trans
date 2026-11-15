import { queryOptions } from "@tanstack/react-query"
import { activeRunsFn, getRunFn, runHistoryFn } from "./matching.functions"
import type { RunHistorySearch } from "./matching.functions"
import type { RunRow } from "@/domain/match-types"

export const matchingKeys = {
  all: ["matching"] as const,
  active: () => [...matchingKeys.all, "active"] as const,
  history: (search: RunHistorySearch) =>
    [...matchingKeys.all, "history", search] as const,
  detail: (id: string) => [...matchingKeys.all, "run", id] as const,
}

const isLive = (r: RunRow) => r.status === "queued" || r.status === "running"

export const matchingQueries = {
  /** Spec §5.5: 1 s while anything runs, 15 s idle (catches runs started elsewhere), never when hidden. */
  active: () =>
    queryOptions({
      queryKey: matchingKeys.active(),
      queryFn: () => activeRunsFn(),
      staleTime: 0,
      refetchInterval: (query) =>
        (query.state.data?.length ?? 0) > 0 ? 1_000 : 15_000,
      refetchIntervalInBackground: false,
    }),
  history: (search: RunHistorySearch) =>
    queryOptions({
      queryKey: matchingKeys.history(search),
      queryFn: () => runHistoryFn({ data: search }),
    }),
  detail: (id: string) =>
    queryOptions({
      queryKey: matchingKeys.detail(id),
      queryFn: () => getRunFn({ data: { id } }),
      refetchInterval: (query) =>
        query.state.data && isLive(query.state.data) ? 1_000 : false,
    }),
}
