import { queryOptions } from "@tanstack/react-query"
import {
  getPatientFn,
  listPatientsFn,
  patientStatsFn,
} from "./patients.functions"
import type { PatientFilter, PatientListSearch } from "./patients.functions"

export const patientKeys = {
  all: ["patients"] as const,
  lists: () => [...patientKeys.all, "list"] as const,
  list: (search: PatientListSearch) =>
    [...patientKeys.lists(), search] as const,
  /** Under lists(): every write that invalidates the lists refreshes the counts too. */
  stats: (filter: PatientFilter) =>
    [...patientKeys.lists(), "stats", filter] as const,
  details: () => [...patientKeys.all, "detail"] as const,
  detail: (id: string) => [...patientKeys.details(), id] as const,
}

export const patientQueries = {
  list: (search: PatientListSearch) =>
    queryOptions({
      queryKey: patientKeys.list(search),
      queryFn: () => listPatientsFn({ data: search }),
    }),
  /** Pick the filter keys so paging or sorting never refetches the counts. */
  stats: ({ q, state, abo, urgency, flag }: PatientFilter) => {
    const filter: PatientFilter = { q, state, abo, urgency, flag }
    return queryOptions({
      queryKey: patientKeys.stats(filter),
      queryFn: () => patientStatsFn({ data: filter }),
    })
  },
  detail: (id: string) =>
    queryOptions({
      queryKey: patientKeys.detail(id),
      queryFn: () => getPatientFn({ data: { id } }),
    }),
}
