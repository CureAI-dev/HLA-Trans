import { MutationCache, QueryClient } from "@tanstack/react-query"
import { errorMessage, isAppError } from "./app-error"
import { toast } from "@/components/ui/toast"

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: { errorTitle?: string; silent?: boolean }
  }
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
    mutationCache: new MutationCache({
      onError: (error, _variables, _result, mutation) => {
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
