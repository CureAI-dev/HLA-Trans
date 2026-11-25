import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  redirect,
} from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools"
import { TanStackDevtools } from "@tanstack/react-devtools"

import appCss from "../styles.css?url"
import type { RouterContext } from "@/router"
import { readPrefs } from "@/lib/prefs"
import { matchingQueries } from "@/features/matching/matching.queries"
import { authQueries } from "@/features/auth/auth.queries"
import { AppShell } from "@/components/app/app-shell"
import { NotFound } from "@/components/app/route-error"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/toast"

export const Route = createRootRouteWithContext<RouterContext>()({
  // Prefs: cookie parse only. Session: cached by Query (5 min), so client navigations stay instant.
  // This guard is UX only; every server function re-checks the session (readMiddleware).
  beforeLoad: async ({ context, location }) => {
    const prefs = readPrefs()
    const user = await context.queryClient.ensureQueryData(
      authQueries.session()
    )
    if (!user && location.pathname !== "/sign-in")
      throw redirect({
        to: "/sign-in",
        search: { redirect: location.href },
      })
    return { prefs, user }
  },
  // Active runs feed the header indicator and sidebar badge; include them in the SSR HTML.
  // ensureQueryData returns the cached value instantly after the first load.
  loader: ({ context }) =>
    context.user
      ? context.queryClient.ensureQueryData(matchingQueries.active())
      : undefined,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Concord" },
      { name: "theme-color", content: "#095d6c" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", sizes: "48x48" },
      {
        rel: "icon",
        href: "/concord-symbol-inverted.svg",
        type: "image/svg+xml",
      },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.json" },
    ],
  }),
  notFoundComponent: NotFound,
  shellComponent: RootDocument,
  component: RootComponent,
})

function RootComponent() {
  const { user } = Route.useRouteContext()
  return (
    <TooltipProvider>
      <Toaster>
        {user ? (
          <AppShell userId={user.id}>
            <Outlet />
          </AppShell>
        ) : (
          <Outlet />
        )}
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
