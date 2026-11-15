import { useMemo } from "react"
import type { ReactNode } from "react"
import { Check, CircleAlert, CircleDashed } from "lucide-react"
import { cn } from "cn"
import { useScrollSpy } from "./use-scroll-spy"

export type SectionStatus = { errors: number; missing: number }

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
  return (
    <div className="grid gap-6 xl:grid-cols-[220px_minmax(0,768px)_300px] xl:justify-center">
      <nav
        aria-label="Form sections"
        className="-mx-4 overflow-x-auto px-4 xl:sticky xl:top-20 xl:mx-0 xl:self-start xl:overflow-visible xl:px-0"
      >
        <ol className="flex gap-1 xl:flex-col">
          {sections.map((s) => {
            const st = status[s.id] ?? { errors: 0, missing: 0 }
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() =>
                    document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }
                  aria-current={active === s.id ? "location" : undefined}
                  className={cn(
                    "flex w-full items-center gap-2 border-l-2 border-transparent px-3 py-1.5 text-left text-sm whitespace-nowrap hover:bg-muted",
                    active === s.id && "border-primary bg-muted font-medium"
                  )}
                >
                  {st.errors ? (
                    <CircleAlert className="size-3.5 text-destructive" aria-label={`${st.errors} errors`} />
                  ) : st.missing ? (
                    <CircleDashed
                      className="size-3.5 text-muted-foreground"
                      aria-label={`${st.missing} not recorded`}
                    />
                  ) : (
                    <Check className="size-3.5 text-muted-foreground" aria-label="Complete" />
                  )}
                  {s.title}
                </button>
              </li>
            )
          })}
        </ol>
      </nav>
      <div className="min-w-0 space-y-6">{children}</div>
      <aside className="hidden xl:sticky xl:top-20 xl:block xl:self-start">
        <div className="space-y-4">
          {rail}
          <div className="flex gap-2">{actions}</div>
        </div>
      </aside>
      {/* Below xl: sticky action bar so Save is always reachable. */}
      <div className="sticky bottom-0 z-10 -mx-4 flex items-center gap-2 border-t bg-background/95 p-3 backdrop-blur xl:hidden">
        {actions}
      </div>
    </div>
  )
}
