import { Link, useRouterState } from "@tanstack/react-router"
import type { LinkOptions } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import { ScrollArea } from "@/components/ui/scroll-area"
import { matchingQueries } from "@/features/matching/matching.queries"
import { GuideCard } from "@/features/guide/components/guide-card"
import { ConcordMark } from "./concord-logo"

type NavItem = {
  label: string
  link: LinkOptions
  isActive: (pathname: string) => boolean
  /** Shows the live count of active match runs. */
  liveCount?: boolean
}
const under = (base: string) => (pathname: string) =>
  pathname === base || pathname.startsWith(`${base}/`)

const groups: ReadonlyArray<{ guide: string; items: ReadonlyArray<NavItem> }> =
  [
    {
      guide: "nav-records",
      items: [
        { label: "Dashboard", link: { to: "/" }, isActive: (p) => p === "/" },
        {
          label: "Patients",
          link: { to: "/patients" },
          isActive: under("/patients"),
        },
        {
          label: "Donors",
          link: { to: "/donors" },
          isActive: under("/donors"),
        },
      ],
    },
    {
      guide: "nav-matching",
      items: [
        {
          label: "Matching",
          link: { to: "/matching" },
          isActive: under("/matching"),
          liveCount: true,
        },
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
      ],
    },
    {
      guide: "nav-settings",
      items: [
        {
          label: "Criteria",
          link: { to: "/criteria" },
          isActive: under("/criteria"),
        },
        {
          label: "Audit log",
          link: { to: "/audit" },
          isActive: under("/audit"),
        },
        { label: "Data", link: { to: "/data" }, isActive: under("/data") },
      ],
    },
  ]

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  // Same cached, polled query as the header indicator: no extra request.
  const { data: activeRuns } = useQuery(matchingQueries.active())
  const activeCount = activeRuns?.length ?? 0
  return (
    <ScrollArea className="h-full" contentClassName="flex min-h-full flex-col">
      <Link
        to="/"
        onClick={onNavigate}
        className="flex items-center gap-2 border-b px-5 py-5 text-lg font-semibold"
      >
        <ConcordMark className="text-primary" />
        Concord
      </Link>
      <p className="px-5 pt-5 pb-2 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
        Heart compatibility
      </p>
      <nav aria-label="Main navigation" className="space-y-1 px-3">
        {groups.map((group) => (
          <div key={group.guide} data-guide={group.guide} className="space-y-1">
            {group.items.map((item) => {
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
                  {item.liveCount && activeCount > 0 && (
                    <span className="ml-auto min-w-5 bg-primary px-1.5 py-0.5 text-center text-[10px] font-semibold text-primary-foreground tabular-nums">
                      {activeCount}
                      <span className="sr-only"> running</span>
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>
      <div className="mt-auto">
        <GuideCard onOpen={onNavigate} />
      </div>
      <p className="border-t p-5 text-xs leading-relaxed text-muted-foreground">
        Clinical review workspace
        <br />
        Shared PostgreSQL database
      </p>
    </ScrollArea>
  )
}
