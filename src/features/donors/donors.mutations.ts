import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  createDonorFn,
  deleteDonorFn,
  rerunDonorFn,
  updateDonorFn,
} from "./donors.functions"
import { donorKeys } from "./donors.queries"
import { matchingKeys } from "@/features/matching/matching.queries"
import { matchKeys } from "@/features/matches/matches.queries"
import { dashboardKeys } from "@/features/dashboard/dashboard.queries"
import type { Donor } from "@/domain/schema"

export function useCreateDonor() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ["donors", "create"],
    meta: { errorTitle: "Donor not saved" },
    mutationFn: (donor: Donor) => createDonorFn({ data: donor }),
    onSuccess: ({ donor }) => {
      qc.setQueryData(donorKeys.detail(donor.record.id), donor)
      void qc.invalidateQueries({ queryKey: donorKeys.lists() })
      void qc.invalidateQueries({ queryKey: matchingKeys.all })
      void qc.invalidateQueries({ queryKey: dashboardKeys.all })
    },
  })
}

export function useUpdateDonor() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ["donors", "update"],
    meta: { errorTitle: "Donor not saved" },
    mutationFn: (input: { donor: Donor; expectedVersion: number }) =>
      updateDonorFn({ data: input }),
    onSuccess: (saved) => {
      qc.setQueryData(donorKeys.detail(saved.record.id), saved)
      void qc.invalidateQueries({ queryKey: donorKeys.lists() })
      // Results for this donor are now "out of date".
      void qc.invalidateQueries({ queryKey: matchKeys.all })
    },
  })
}

export function useDeleteDonor() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ["donors", "delete"],
    meta: { errorTitle: "Donor not deleted" },
    mutationFn: (id: string) => deleteDonorFn({ data: { id } }),
    onSuccess: (_void, id) => {
      qc.removeQueries({ queryKey: donorKeys.detail(id) })
      void qc.invalidateQueries({ queryKey: donorKeys.lists() })
      void qc.invalidateQueries({ queryKey: dashboardKeys.all })
    },
  })
}

export function useRerunDonor() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ["donors", "rerun"],
    meta: { errorTitle: "Matching not started" },
    mutationFn: (id: string) => rerunDonorFn({ data: { id } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: matchingKeys.all }),
  })
}
