import { createFileRoute, redirect } from "@tanstack/react-router"
import { z } from "zod"

export const Route = createFileRoute("/evaluations/new")({
  validateSearch: z.object({
    patientId: z.string().optional().catch(undefined),
    donorId: z.string().optional().catch(undefined),
  }),
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/matches/check", search, replace: true })
  },
})
