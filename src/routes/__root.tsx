import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools"
import { TanStackDevtools } from "@tanstack/react-devtools"

import appCss from "../styles.css?url"
import type { RouterContext } from "@/router"
import { readPrefs } from "@/lib/prefs"
import { matchingQueries } from "@/features/matching/matching.queries"
import { AppShell } from "@/components/app/app-shell"
import { NotFound } from "@/components/app/route-error"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/toast"

export const Route = createRootRouteWithContext<RouterContext>()({
  // Cookie parse only: microseconds on the client, so it is fine on every navigation.
  beforeLoad: () => ({ prefs: readPrefs() }),
  // Active runs feed the header indicator and sidebar badge; include them in the SSR HTML.
  // ensureQueryData returns the cached value instantly after the first load.
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(matchingQueries.active()),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "HLA-Trans" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  notFoundComponent: NotFound,
  shellComponent: RootDocument,
  component: RootComponent,
})

function RootComponent() {
  return (
    <TooltipProvider>
      <Toaster>
        <AppShell>
          <Outlet />
        </AppShell>
        {import.meta.env.DEV && (
          <TanStackDevtools
            config={{ position: "bottom-right" }}
            plugins={[
              {
                name: "TanStack Router",
                render: <TanStackRouterDevtoolsPanel />,
              },
              { name: "TanStack Query", render: <ReactQueryDevtoolsPanel /> },
            ]}
          />
        )}
      </Toaster>
    </TooltipProvider>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const { prefs } = Route.useRouteContext()
  return (
    <html
      lang="en"
      className={prefs.theme === "dark" ? "dark" : undefined}
      style={{ colorScheme: prefs.theme }}
    >
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
