import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query"
import { errorMessage, isAppError } from "./app-error"
import { toast } from "@/components/ui/toast"

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: { errorTitle?: string; silent?: boolean }
  }
}

/** Session expired mid-use: start over at the sign-in page (full load drops cached data). */
function onSessionLost(error: unknown): boolean {
  if (typeof window === "undefined") return false
  if (!isAppError(error) || error.code !== "UNAUTHENTICATED") return false
  const back = window.location.pathname + window.location.search
  window.location.assign(`/sign-in?redirect=${encodeURIComponent(back)}`)
  return true
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 300_000,
        // Domain errors (404, validation) never succeed on retry.
        retry: (failureCount, error) => !isAppError(error) && failureCount < 1,
        refetchOnWindowFocus: true,
      },
      mutations: { retry: 0 },
    },
    queryCache: new QueryCache({
      onError: (error) => void onSessionLost(error),
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _result, mutation) => {
        if (onSessionLost(error)) return
        if (mutation.meta?.silent || typeof window === "undefined") return
        toast.add({
          type: "error",
          title: mutation.meta?.errorTitle ?? "Action failed",
          description: errorMessage(error, "The change was not saved."),
        })
      },
    }),
  })
}
