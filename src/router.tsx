import { createRouter } from "@tanstack/react-router"
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query"
import type { QueryClient } from "@tanstack/react-query"
import { routeTree } from "./routeTree.gen"
import { createQueryClient } from "@/lib/query-client"
import type { Prefs } from "@/lib/prefs"
import { PagePending } from "@/components/app/page-skeletons"
import { NotFound, RouteError } from "@/components/app/route-error"

export type RouterContext = { queryClient: QueryClient; prefs?: Prefs }

/** Called once per SSR request and once in the browser: never share a QueryClient across users. */
export function getRouter() {
  const queryClient = createQueryClient()
  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    // Query owns freshness; the router always asks it.
    defaultPreloadStaleTime: 0,
    defaultPendingMs: 150,
    defaultPendingMinMs: 300,
    defaultPendingComponent: PagePending,
    defaultErrorComponent: RouteError,
    defaultNotFoundComponent: NotFound,
  })
  setupRouterSsrQueryIntegration({ router, queryClient })
  return router
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
