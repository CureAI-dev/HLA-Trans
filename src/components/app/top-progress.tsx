import { useEffect, useState } from "react"
import { useRouterState } from "@tanstack/react-router"
import { useIsFetching } from "@tanstack/react-query"
import { cn } from "cn"

/** Appears only after 150 ms so fast transitions stay visually silent. Ignores background polling. */
export function TopProgress() {
  const routing = useRouterState({ select: (s) => s.status === "pending" })
  const fetching =
    useIsFetching({
      predicate: (q) => q.queryKey[0] !== "matching" && q.state.data === undefined,
    }) > 0
  const active = routing || fetching
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!active) {
      setVisible(false)
      return
    }
    const timer = setTimeout(() => setVisible(true), 150)
    return () => clearTimeout(timer)
  }, [active])
  if (!visible) return null
  return (
    <div
      role="progressbar"
      aria-label="Loading page"
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 origin-left bg-primary",
        "animate-[hla-progress_1.4s_ease-out_forwards] motion-reduce:animate-none"
      )}
    />
  )
}
