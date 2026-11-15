import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/evaluations/$evaluationId")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/matches/$matchId",
      params: { matchId: params.evaluationId },
      replace: true,
    })
  },
})
