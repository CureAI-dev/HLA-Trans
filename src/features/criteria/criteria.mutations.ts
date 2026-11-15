import { useMutation, useQueryClient } from "@tanstack/react-query"
import { publishCriteriaFn } from "./criteria.functions"
import { criteriaKeys } from "./criteria.queries"
import { matchKeys } from "@/features/matches/matches.queries"
import type { Criteria } from "@/domain/schema"

export function usePublishCriteria() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ["criteria", "publish"],
    meta: { errorTitle: "Criteria not published" },
    mutationFn: (input: { criteria: Criteria; changeNote: string }) =>
      publishCriteriaFn({ data: input }),
    onSuccess: (version) => {
      qc.setQueryData(criteriaKeys.latest(), version)
      void qc.invalidateQueries({ queryKey: criteriaKeys.versions() })
      void qc.invalidateQueries({ queryKey: matchKeys.all }) // every result is now out of date
    },
  })
}
