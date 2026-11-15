import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  createPatientFn,
  deletePatientFn,
  rerunPatientFn,
  updatePatientFn,
} from "./patients.functions"
import { patientKeys } from "./patients.queries"
import { matchingKeys } from "@/features/matching/matching.queries"
import { matchKeys } from "@/features/matches/matches.queries"
import { dashboardKeys } from "@/features/dashboard/dashboard.queries"
import type { Patient } from "@/domain/schema"

export function useCreatePatient() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ["patients", "create"],
    meta: { errorTitle: "Patient not saved" },
    mutationFn: (patient: Patient) => createPatientFn({ data: patient }),
    onSuccess: ({ patient }) => {
      qc.setQueryData(patientKeys.detail(patient.record.id), patient)
      void qc.invalidateQueries({ queryKey: patientKeys.lists() })
      void qc.invalidateQueries({ queryKey: matchingKeys.all })
      void qc.invalidateQueries({ queryKey: dashboardKeys.all })
    },
  })
}

export function useUpdatePatient() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ["patients", "update"],
    meta: { errorTitle: "Patient not saved" },
    mutationFn: (input: { patient: Patient; expectedVersion: number }) =>
      updatePatientFn({ data: input }),
    onSuccess: (saved) => {
      qc.setQueryData(patientKeys.detail(saved.record.id), saved)
      void qc.invalidateQueries({ queryKey: patientKeys.lists() })
      // Results for this patient are now "out of date".
      void qc.invalidateQueries({ queryKey: matchKeys.all })
    },
  })
}

export function useDeletePatient() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ["patients", "delete"],
    meta: { errorTitle: "Patient not deleted" },
    mutationFn: (id: string) => deletePatientFn({ data: { id } }),
    onSuccess: (_void, id) => {
      qc.removeQueries({ queryKey: patientKeys.detail(id) })
      void qc.invalidateQueries({ queryKey: patientKeys.lists() })
      void qc.invalidateQueries({ queryKey: dashboardKeys.all })
    },
  })
}

export function useRerunPatient() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ["patients", "rerun"],
    meta: { errorTitle: "Matching not started" },
    mutationFn: (id: string) => rerunPatientFn({ data: { id } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: matchingKeys.all }),
  })
}
