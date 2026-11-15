import { useEffect } from "react"
import { Link, useRouter } from "@tanstack/react-router"
import type { ErrorComponentProps } from "@tanstack/react-router"
import { useQueryErrorResetBoundary } from "@tanstack/react-query"
import { FileQuestion, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

// TODO(Task 3): replace with `errorMessage` from "@/lib/app-error" once it exists.
function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === "string" && error) return error
  return fallback
}

export function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  const boundary = useQueryErrorResetBoundary()
  // Let suspense queries refetch when the route retries.
  useEffect(() => boundary.reset(), [boundary])
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <TriangleAlert />
        </EmptyMedia>
        <EmptyTitle>This page could not load</EmptyTitle>
        <EmptyDescription>{errorMessage(error, "An unexpected error occurred.")}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button
          onClick={() => {
            reset()
            void router.invalidate()
          }}
        >
          Retry
        </Button>
      </EmptyContent>
    </Empty>
  )
}

export function NotFound() {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileQuestion />
        </EmptyMedia>
        <EmptyTitle>Not found</EmptyTitle>
        <EmptyDescription>This record does not exist or was deleted.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button nativeButton={false} render={<Link to="/" />}>
          Go to dashboard
        </Button>
      </EmptyContent>
    </Empty>
  )
}
