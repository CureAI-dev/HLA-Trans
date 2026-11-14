import { useRouterState } from "@tanstack/react-router"
import { Activity } from "lucide-react"
import { cn } from "cn"

const items = [
  ["Dashboard", "/"],
  ["Patients", "/patients"],
  ["Donors", "/donors"],
  ["New evaluation", "/evaluations/new"],
  ["Evaluations", "/evaluations"],
  ["Criteria", "/criteria"],
  ["Audit log", "/audit"],
  ["Data", "/data"],
]
export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  return (
    <div className="flex h-full flex-col">
      <a
        href="/"
        className="flex items-center gap-2 border-b px-5 py-5 text-lg font-semibold"
      >
        <Activity className="size-5 text-primary" aria-hidden="true" />
        HLA-Trans
      </a>
      <p className="px-5 pt-5 pb-2 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
        Heart compatibility
      </p>
      <nav aria-label="Main navigation" className="space-y-1 px-3">
        {items.map(([label, href]) => {
          const active =
            href === "/"
              ? pathname === "/"
              : href === "/evaluations"
                ? pathname.startsWith(href) && pathname !== "/evaluations/new"
                : pathname === href || pathname.startsWith(`${href}/`)
          return (
            <a
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 border-l-2 border-transparent px-3 py-2.5 text-sm hover:bg-sidebar-accent",
                active && "border-primary bg-sidebar-accent font-semibold"
              )}
            >
              {label}
            </a>
          )
        })}
      </nav>
      <p className="mt-auto border-t p-5 text-xs leading-relaxed text-muted-foreground">
        Clinical review workspace
        <br />
        Local browser storage
      </p>
    </div>
  )
}
