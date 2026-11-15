import { useMemo, useSyncExternalStore } from "react"
import type { ReactNode } from "react"
import { Check, ChevronDown, CircleAlert, CircleDashed } from "lucide-react"
import { cn } from "cn"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { useScrollSpy } from "./use-scroll-spy"

export type SectionStatus = { errors: number; missing: number }

const XL = "(min-width: 1280px)"
const subscribeXl = (onChange: () => void) => {
  const mql = window.matchMedia(XL)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}
/** The rail and actions mount once (not once per breakpoint), so they render once per keystroke. */
function useIsXl() {
  return useSyncExternalStore(
    subscribeXl,
    () => window.matchMedia(XL).matches,
    () => true
  )
}

export function FormLayout({
  sections,
  status,
  rail,
  actions,
  children,
}: {
  sections: ReadonlyArray<{ id: string; title: string }>
  status: Record<string, SectionStatus>
  rail: ReactNode
  actions: ReactNode
  children: ReactNode
}) {
  const idKey = sections.map((s) => s.id).join("|")
  const ids = useMemo(() => (idKey ? idKey.split("|") : []), [idKey])
  const active = useScrollSpy(ids)
  const xl = useIsXl()
  return (
    <div className="grid gap-6 xl:grid-cols-[220px_minmax(0,768px)_300px] xl:justify-center">
      <nav
        aria-label="Form sections"
        className="-mx-4 overflow-x-auto px-4 xl:sticky xl:top-20 xl:mx-0 xl:max-h-[calc(100vh-6rem)] xl:self-start xl:overflow-y-auto xl:px-0"
      >
        <ol className="flex gap-1 xl:flex-col">
          {sections.map((s) => {
            const st = status[s.id] ?? { errors: 0, missing: 0 }
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() =>
                    document
                      .getElementById(s.id)
                      ?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }
                  aria-current={active === s.id ? "location" : undefined}
                  className={cn(
                    "flex w-full items-center gap-2 border-l-2 border-transparent px-3 py-1.5 text-left text-sm whitespace-nowrap hover:bg-muted",
                    active === s.id && "border-primary bg-muted font-medium"
                  )}
                >
                  {st.errors ? (
                    <CircleAlert
                      className="size-3.5 shrink-0 text-destructive"
                      aria-label={`${st.errors} ${st.errors === 1 ? "error" : "errors"}`}
                    />
                  ) : st.missing ? (
                    <CircleDashed
                      className="size-3.5 shrink-0 text-muted-foreground"
                      aria-label={`${st.missing} not recorded`}
                    />
                  ) : (
                    <Check
                      className="size-3.5 shrink-0 text-muted-foreground"
                      aria-label="Complete"
                    />
                  )}
                  {s.title}
                </button>
              </li>
            )
          })}
        </ol>
      </nav>
      <div className="min-w-0 space-y-6">
        {!xl && (
          <Collapsible className="border">
            <CollapsibleTrigger className="group flex w-full items-center justify-between px-3 py-2 text-sm font-medium">
              Derived values and completeness
              <ChevronDown
                className="size-4 transition-transform group-data-[panel-open]:rotate-180"
                aria-hidden="true"
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 border-t p-3">
              {rail}
            </CollapsibleContent>
          </Collapsible>
        )}
        {children}
      </div>
      {xl ? (
        <aside
          aria-label="Form summary"
          className="sticky top-20 max-h-[calc(100vh-6rem)] self-start overflow-y-auto"
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">{actions}</div>
            {rail}
          </div>
        </aside>
      ) : (
        /* Below xl: sticky action bar so Save is always reachable. */
        <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-t bg-background/95 p-3 backdrop-blur">
          {actions}
        </div>
      )}
    </div>
  )
}
