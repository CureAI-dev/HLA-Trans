import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/evaluations/")({
  beforeLoad: () => {
    throw redirect({ to: "/matches", replace: true })
  },
})
