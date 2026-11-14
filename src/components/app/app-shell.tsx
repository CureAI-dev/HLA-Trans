import { useState } from "react"
import type { ReactNode } from "react"
import { Menu, TriangleAlert } from "lucide-react"
import { dbStore, useDb } from "@/lib/storage/db"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { AppSidebar } from "./app-sidebar"
import { ClinicianControl } from "./clinician-control"
import { DemoBanner } from "./demo-banner"
import { ThemeToggle } from "./theme-toggle"

export function AppShell({ children }: { children: ReactNode }) {
  useDb()
  const [open, setOpen] = useState(false)
  const [recoveryDismissed, setRecoveryDismissed] = useState(false)
  const notice = dbStore.recoveryNotice()
  return (
    <div className="min-h-svh">
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
                  HLA-Trans navigation
                </SheetTitle>
                <AppSidebar onNavigate={() => setOpen(false)} />
              </SheetContent>
            </Sheet>
            <span className="text-sm font-medium">
              Heart transplant compatibility
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ClinicianControl />
            <ThemeToggle />
          </div>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto max-w-[1600px] p-4 outline-none lg:p-6"
        >
          {notice && !recoveryDismissed && (
            <Alert variant="destructive" className="mb-6">
              <TriangleAlert aria-hidden="true" />
              <AlertTitle>Stored data recovery</AlertTitle>
              <AlertDescription>
                <p>{notice}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => setRecoveryDismissed(true)}
                >
                  Dismiss notice
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {children}
        </main>
      </div>
    </div>
  )
}
