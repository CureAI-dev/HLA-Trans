import { useMutation, useQueryClient } from "@tanstack/react-query"
import { cancelRunFn } from "./matching.functions"
import { matchingKeys } from "./matching.queries"

export function useCancelRun() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ["matching", "cancel"],
    meta: { errorTitle: "Run not cancelled" },
    mutationFn: (id: string) => cancelRunFn({ data: { id } }),
    onSettled: () => void qc.invalidateQueries({ queryKey: matchingKeys.all }),
  })
}
