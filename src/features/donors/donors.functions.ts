import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { errorMiddleware, writeMiddleware } from "@/features/shared/middleware"
import {
  ABO_VALUES,
  DONATION_TYPE_VALUES,
  DONOR_STATE_VALUES,
} from "@/domain/options"
import { donorSchema } from "@/domain/schema"
import { getDb } from "@/server/db/client.server"
import {
  getDonor,
  listDonors,
  softDeleteDonor,
  updateDonor,
} from "@/server/repos/donors.server"
import {
  createDonorWithRun,
  rerunForDonor,
} from "@/server/services/records.server"

export const donorListSearch = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  state: z.enum(DONOR_STATE_VALUES).optional().catch(undefined),
  abo: z.enum(ABO_VALUES).optional().catch(undefined),
  donationType: z.enum(DONATION_TYPE_VALUES).optional().catch(undefined),
  sort: z.enum(["updated", "code"]).optional().catch(undefined),
  cursor: z.string().max(600).optional().catch(undefined),
})
export type DonorListSearch = z.infer<typeof donorListSearch>
const idInput = z.object({ id: z.string().min(1).max(64) })

export const listDonorsFn = createServerFn({ method: "GET" })
  .middleware([errorMiddleware])
  .validator(donorListSearch)
  .handler(({ data }) => listDonors(getDb(), data))

export const getDonorFn = createServerFn({ method: "GET" })
  .middleware([errorMiddleware])
  .validator(idInput)
  .handler(({ data }) => getDonor(getDb(), data.id))

export const createDonorFn = createServerFn({ method: "POST" })
  .middleware([writeMiddleware])
  .validator(donorSchema)
  .handler(({ data, context }) =>
    createDonorWithRun(getDb(), data, context.actor)
  )

export const updateDonorFn = createServerFn({ method: "POST" })
  .middleware([writeMiddleware])
  .validator(
    z.object({
      donor: donorSchema,
      expectedVersion: z.number().int().min(1),
    })
  )
  .handler(({ data, context }) =>
    updateDonor(getDb(), data.donor, data.expectedVersion, context.actor)
  )

export const deleteDonorFn = createServerFn({ method: "POST" })
  .middleware([writeMiddleware])
  .validator(idInput)
  .handler(({ data, context }) =>
    softDeleteDonor(getDb(), data.id, context.actor)
  )

export const rerunDonorFn = createServerFn({ method: "POST" })
  .middleware([writeMiddleware])
  .validator(idInput)
  .handler(({ data, context }) =>
    rerunForDonor(getDb(), data.id, context.actor)
  )
