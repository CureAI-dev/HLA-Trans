import { useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import { Menu } from "lucide-react"
import { useRouterState } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { APP_SCROLL_ID } from "@/lib/app-scroll"
import { AppSidebar } from "./app-sidebar"
import { UserMenu } from "./user-menu"
import { DemoBanner } from "./demo-banner"
import { LegacyImportBanner } from "./legacy-import-banner"
import { ThemeToggle } from "./theme-toggle"
import { TopProgress } from "./top-progress"
import { RunIndicator } from "@/features/matching/components/run-indicator"
import { GuideRoot } from "@/features/guide/components/guide-root"
import { RunWatcher } from "@/features/matching/components/run-watcher"

export function AppShell({
  userId,
  children,
}: {
  userId: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const viewport = useRef<HTMLDivElement>(null)
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  // The window no longer scrolls, so give the viewport focus on a new page when nothing else
  // has it: Space and the Page keys keep scrolling.
  useEffect(() => {
    if (document.activeElement === document.body)
      viewport.current?.focus({ preventScroll: true })
  }, [pathname])
  return (
    <div className="flex h-dvh overflow-hidden">
      <TopProgress />
      <RunWatcher />
      <GuideRoot userId={userId} />
      <a
        href="#main-content"
        className="sr-only fixed top-2 left-2 z-[100] bg-background p-3 focus:not-sr-only"
      >
        Skip to main content
      </a>
      <aside className="hidden w-56 shrink-0 border-r bg-sidebar text-sidebar-foreground lg:block">
        <AppSidebar />
      </aside>
      <ScrollArea
        className="flex-1"
        viewportProps={{
          ref: viewport,
          id: APP_SCROLL_ID,
          // Scroll memory for back and forward (router scrollRestoration).
          ...{ "data-scroll-restoration-id": APP_SCROLL_ID },
          className: "overscroll-contain focus-visible:ring-0",
        }}
      >
        <DemoBanner />
        <header className="flex min-h-16 flex-wrap items-center justify-between gap-2 border-b bg-card px-4 py-2 lg:px-6">
          <div className="flex items-center gap-2">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden"
                    aria-label="Open navigation"
                    data-guide="nav-menu"
                  />
                }
              >
                <Menu />
              </SheetTrigger>
              <SheetContent side="left" className="w-72 bg-sidebar p-0">
                <SheetTitle className="sr-only">Concord navigation</SheetTitle>
                <AppSidebar onNavigate={() => setOpen(false)} />
              </SheetContent>
            </Sheet>
            <span className="text-sm font-medium">
              Heart transplant compatibility
            </span>
          </div>
          <div className="flex items-center gap-2">
            <RunIndicator />
            <div data-guide="user-area" className="flex items-center gap-2">
              <UserMenu />
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto max-w-[1600px] p-4 outline-none lg:p-6"
        >
          <LegacyImportBanner />
          {children}
        </main>
      </ScrollArea>
    </div>
  )
}
