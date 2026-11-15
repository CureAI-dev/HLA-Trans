import { queryOptions } from "@tanstack/react-query"
import { getPatientFn, listPatientsFn } from "./patients.functions"
import type { PatientListSearch } from "./patients.functions"

export const patientKeys = {
  all: ["patients"] as const,
  lists: () => [...patientKeys.all, "list"] as const,
  list: (search: PatientListSearch) => [...patientKeys.lists(), search] as const,
  details: () => [...patientKeys.all, "detail"] as const,
  detail: (id: string) => [...patientKeys.details(), id] as const,
}

export const patientQueries = {
  list: (search: PatientListSearch) =>
    queryOptions({
      queryKey: patientKeys.list(search),
      queryFn: () => listPatientsFn({ data: search }),
    }),
  detail: (id: string) =>
    queryOptions({
      queryKey: patientKeys.detail(id),
      queryFn: () => getPatientFn({ data: { id } }),
    }),
}
