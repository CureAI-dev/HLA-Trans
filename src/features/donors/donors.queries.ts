import { queryOptions } from "@tanstack/react-query"
import { getDonorFn, listDonorsFn } from "./donors.functions"
import type { DonorListSearch } from "./donors.functions"

export const donorKeys = {
  all: ["donors"] as const,
  lists: () => [...donorKeys.all, "list"] as const,
  list: (search: DonorListSearch) => [...donorKeys.lists(), search] as const,
  details: () => [...donorKeys.all, "detail"] as const,
  detail: (id: string) => [...donorKeys.details(), id] as const,
}

export const donorQueries = {
  list: (search: DonorListSearch) =>
    queryOptions({
      queryKey: donorKeys.list(search),
      queryFn: () => listDonorsFn({ data: search }),
    }),
  detail: (id: string) =>
    queryOptions({
      queryKey: donorKeys.detail(id),
      queryFn: () => getDonorFn({ data: { id } }),
    }),
}
