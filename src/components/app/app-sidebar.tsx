import { Link, useRouterState } from "@tanstack/react-router"
import type { LinkOptions } from "@tanstack/react-router"
import { Activity } from "lucide-react"
import { cn } from "cn"

type NavItem = {
  label: string
  link: LinkOptions
  isActive: (pathname: string) => boolean
}
const under = (base: string) => (pathname: string) =>
  pathname === base || pathname.startsWith(`${base}/`)

const items: ReadonlyArray<NavItem> = [
  { label: "Dashboard", link: { to: "/" }, isActive: (p) => p === "/" },
  {
    label: "Patients",
    link: { to: "/patients" },
    isActive: under("/patients"),
  },
  { label: "Donors", link: { to: "/donors" }, isActive: under("/donors") },
  {
    label: "Match results",
    link: { to: "/matches" },
    isActive: (p) => under("/matches")(p) && p !== "/matches/check",
  },
  {
    label: "Check a pair",
    link: { to: "/matches/check" },
    isActive: (p) => p === "/matches/check",
  },
  {
    label: "Criteria",
    link: { to: "/criteria" },
    isActive: under("/criteria"),
  },
  { label: "Audit log", link: { to: "/audit" }, isActive: under("/audit") },
  { label: "Data", link: { to: "/data" }, isActive: under("/data") },
]

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  return (
    <div className="flex h-full flex-col">
      <Link
        to="/"
        onClick={onNavigate}
        className="flex items-center gap-2 border-b px-5 py-5 text-lg font-semibold"
      >
        <Activity className="size-5 text-primary" aria-hidden="true" />
        HLA-Trans
      </Link>
      <p className="px-5 pt-5 pb-2 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
        Heart compatibility
      </p>
      <nav aria-label="Main navigation" className="space-y-1 px-3">
        {items.map((item) => {
          const active = item.isActive(pathname)
          return (
            <Link
              key={item.label}
              {...item.link}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 border-l-2 border-transparent px-3 py-2.5 text-sm hover:bg-sidebar-accent",
                active && "border-primary bg-sidebar-accent font-semibold"
              )}
            >
              {item.label}
            </Link>
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
