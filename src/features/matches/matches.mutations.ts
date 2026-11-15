import { useMutation, useQueryClient } from "@tanstack/react-query"
import { checkPairFn, decideMatchFn } from "./matches.functions"
import { matchKeys } from "./matches.queries"
import { dashboardKeys } from "@/features/dashboard/dashboard.queries"
import type { Decision, PairInputs } from "@/domain/schema"

export function useCheckPair() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ["matches", "check"],
    meta: { errorTitle: "Match result not saved" },
    mutationFn: (input: {
      patientId: string
      donorId: string
      pair: PairInputs
    }) => checkPairFn({ data: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: matchKeys.lists() })
      void qc.invalidateQueries({ queryKey: dashboardKeys.all })
    },
  })
}

/** Not optimistic: a clinical decision is shown only after the server accepts it. */
export function useDecideMatch(matchId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ["matches", "decide", matchId],
    meta: { errorTitle: "Decision not recorded" },
    mutationFn: (decision: Omit<Decision, "decidedAt">) =>
      decideMatchFn({ data: { matchId, decision } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: matchKeys.detail(matchId) })
      void qc.invalidateQueries({ queryKey: matchKeys.lists() })
      void qc.invalidateQueries({ queryKey: dashboardKeys.all })
    },
  })
}
