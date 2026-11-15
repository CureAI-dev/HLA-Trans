import { useEffect, useRef } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import { matchingKeys, matchingQueries } from "../matching.queries"
import { finishedRunIds } from "../run-math"
import type { RunRow } from "@/domain/match-types"
import { toast } from "@/components/ui/toast"
import { matchKeys } from "@/features/matches/matches.queries"
import { dashboardKeys } from "@/features/dashboard/dashboard.queries"

function toastFor(run: RunRow) {
  if (run.status === "succeeded")
    return {
      type: "success",
      title: `Matching finished for ${run.subjectLabel}`,
      description: `${run.passCount} pass · ${run.reviewCount} review · ${run.failCount} fail`,
    }
  if (run.status === "failed")
    return {
      type: "error",
      title: `Matching failed for ${run.subjectLabel}`,
      description: run.error ?? undefined,
    }
  return {
    type: undefined,
    title: `Matching ${run.status} for ${run.subjectLabel}`,
    description: undefined,
  }
}

/**
 * Mounted once in the shell. A run leaving the active list becomes a toast plus
 * targeted invalidation. The first load only records ids, so history never toasts.
 */
export function RunWatcher() {
  const { data } = useQuery(matchingQueries.active())
  const prev = useRef<ReadonlyArray<string> | null>(null)
  const qc = useQueryClient()
  const router = useRouter()

  useEffect(() => {
    if (!data) return
    const ids = data.map((r) => r.id)
    const done = prev.current ? finishedRunIds(prev.current, ids) : []
    prev.current = ids
    if (!done.length) return
    void qc.invalidateQueries({ queryKey: matchKeys.all })
    void qc.invalidateQueries({ queryKey: dashboardKeys.all })
    void qc.invalidateQueries({ queryKey: [...matchingKeys.all, "history"] })
    for (const id of done) {
      qc.fetchQuery({ ...matchingQueries.detail(id), staleTime: 0 }).then(
        (run) =>
          toast.add({
            ...toastFor(run),
            actionProps: {
              children: "View",
              onClick: () =>
                void router.navigate({
                  to: "/matching/$runId",
                  params: { runId: id },
                }),
            },
          }),
        () => {
          // The run was removed (for example by Reset); nothing to announce.
        }
      )
    }
  }, [data, qc, router])

  return null
}
