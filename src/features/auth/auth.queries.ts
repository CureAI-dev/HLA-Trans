import { queryOptions } from "@tanstack/react-query"
import { sessionFn } from "./auth.functions"

export const authKeys = {
  session: () => ["auth", "session"] as const,
}

export const authQueries = {
  /** Read by the root beforeLoad on every navigation; the server re-checks on each server function. */
  session: () =>
    queryOptions({
      queryKey: authKeys.session(),
      queryFn: () => sessionFn(),
      staleTime: 5 * 60_000,
    }),
}
