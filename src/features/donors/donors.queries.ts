import { queryOptions } from "@tanstack/react-query"
import { getDonorFn, listDonorsFn, donorStatsFn } from "./donors.functions"
import type { DonorFilter, DonorListSearch } from "./donors.functions"

export const donorKeys = {
  all: ["donors"] as const,
  lists: () => [...donorKeys.all, "list"] as const,
  list: (search: DonorListSearch) => [...donorKeys.lists(), search] as const,
  /** Under lists(): every write that invalidates the lists refreshes the counts too. */
  stats: (filter: DonorFilter) =>
    [...donorKeys.lists(), "stats", filter] as const,
  details: () => [...donorKeys.all, "detail"] as const,
  detail: (id: string) => [...donorKeys.details(), id] as const,
}

export const donorQueries = {
  list: (search: DonorListSearch) =>
    queryOptions({
      queryKey: donorKeys.list(search),
      queryFn: () => listDonorsFn({ data: search }),
    }),
  /** Pick the filter keys so paging or sorting never refetches the counts. */
  stats: ({ q, state, abo, donationType }: DonorFilter) => {
    const filter: DonorFilter = { q, state, abo, donationType }
    return queryOptions({
      queryKey: donorKeys.stats(filter),
      queryFn: () => donorStatsFn({ data: filter }),
    })
  },
  detail: (id: string) =>
    queryOptions({
      queryKey: donorKeys.detail(id),
      queryFn: () => getDonorFn({ data: { id } }),
    }),
}
