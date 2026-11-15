import { useEffect, useState } from "react"

/**
 * One IntersectionObserver for all sections: O(1) work per scroll frame, no scroll listeners.
 * Pass a stable `ids` array (useMemo) to avoid re-observing on every render.
 */
export function useScrollSpy(ids: ReadonlyArray<string>): string | null {
  const [active, setActive] = useState<string | null>(ids[0] ?? null)
  useEffect(() => {
    const visible = new Map<string, number>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          visible.set(
            e.target.id,
            e.isIntersecting ? e.boundingClientRect.top : Infinity
          )
        const top = [...visible]
          .filter(([, y]) => y !== Infinity)
          .sort((a, b) => a[1] - b[1])
          .at(0)
        if (top) setActive(top[0])
      },
      { rootMargin: "-80px 0px -60% 0px" }
    )
    for (const id of ids) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [ids])
  return active
}
