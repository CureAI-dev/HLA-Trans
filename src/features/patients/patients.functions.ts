import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { readMiddleware, writeMiddleware } from "@/features/shared/middleware"
import {
  ABO_VALUES,
  CANDIDATE_STATE_VALUES,
  URGENCY_STATUS_VALUES,
} from "@/domain/options"
import { patientSchema } from "@/domain/schema"
import { getDb } from "@/server/db/client.server"
import {
  getPatient,
  listPatients,
  softDeletePatient,
  updatePatient,
} from "@/server/repos/patients.server"
import {
  createPatientWithRun,
  rerunForPatient,
} from "@/server/services/records.server"

export const patientListSearch = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  state: z.enum(CANDIDATE_STATE_VALUES).optional().catch(undefined),
  abo: z.enum(ABO_VALUES).optional().catch(undefined),
  urgency: z.enum(URGENCY_STATUS_VALUES).optional().catch(undefined),
  sort: z.enum(["updated", "name", "listed"]).optional().catch(undefined),
  cursor: z.string().max(600).optional().catch(undefined),
})
export type PatientListSearch = z.infer<typeof patientListSearch>
const idInput = z.object({ id: z.string().min(1).max(64) })

export const listPatientsFn = createServerFn({ method: "GET" })
  .middleware([readMiddleware])
  .validator(patientListSearch)
  .handler(({ data }) => listPatients(getDb(), data))

export const getPatientFn = createServerFn({ method: "GET" })
  .middleware([readMiddleware])
  .validator(idInput)
  .handler(({ data }) => getPatient(getDb(), data.id))

export const createPatientFn = createServerFn({ method: "POST" })
  .middleware([writeMiddleware])
  .validator(patientSchema)
  .handler(({ data, context }) =>
    createPatientWithRun(getDb(), data, context.actor)
  )

export const updatePatientFn = createServerFn({ method: "POST" })
  .middleware([writeMiddleware])
  .validator(
    z.object({
      patient: patientSchema,
      expectedVersion: z.number().int().min(1),
    })
  )
  .handler(({ data, context }) =>
    updatePatient(getDb(), data.patient, data.expectedVersion, context.actor)
  )

export const deletePatientFn = createServerFn({ method: "POST" })
  .middleware([writeMiddleware])
  .validator(idInput)
  .handler(({ data, context }) =>
    softDeletePatient(getDb(), data.id, context.actor)
  )

export const rerunPatientFn = createServerFn({ method: "POST" })
  .middleware([writeMiddleware])
  .validator(idInput)
  .handler(({ data, context }) =>
    rerunForPatient(getDb(), data.id, context.actor)
  )
