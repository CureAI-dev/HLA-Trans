import { useState } from "react"
import type { ReactNode } from "react"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { AppSidebar } from "./app-sidebar"
import { UserMenu } from "./user-menu"
import { DemoBanner } from "./demo-banner"
import { LegacyImportBanner } from "./legacy-import-banner"
import { ThemeToggle } from "./theme-toggle"
import { TopProgress } from "./top-progress"
import { RunIndicator } from "@/features/matching/components/run-indicator"
import { RunWatcher } from "@/features/matching/components/run-watcher"

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="min-h-svh">
      <TopProgress />
      <RunWatcher />
      <a
        href="#main-content"
        className="sr-only fixed top-2 left-2 z-[100] bg-background p-3 focus:not-sr-only"
      >
        Skip to main content
      </a>
      <aside className="fixed inset-y-0 left-0 hidden w-56 border-r bg-sidebar text-sidebar-foreground lg:block">
        <AppSidebar />
      </aside>
      <div className="lg:pl-56">
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
                  />
                }
              >
                <Menu />
              </SheetTrigger>
              <SheetContent side="left" className="w-72 bg-sidebar p-0">
                <SheetTitle className="sr-only">
                  Concord navigation
                </SheetTitle>
                <AppSidebar onNavigate={() => setOpen(false)} />
              </SheetContent>
            </Sheet>
            <span className="text-sm font-medium">
              Heart transplant compatibility
            </span>
          </div>
          <div className="flex items-center gap-2">
            <RunIndicator />
            <UserMenu />
            <ThemeToggle />
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
      </div>
    </div>
  )
}
