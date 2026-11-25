import { Button } from "@/components/ui/button"
import { TUTORIAL_COUNT } from "../guide-meta"
import { overallProgress } from "../guide-progress"
import { openGuide, useGuide } from "../guide-store"
import { ClosingHeart } from "./closing-heart"

/** Sidebar card: always the way to the tutorials. */
export function GuideCard({ onOpen }: { onOpen?: () => void }) {
  const progress = useGuide((s) => s.progress)
  const done = progress.done.length
  const paused = Object.keys(progress.paused).length > 0
  return (
    <section
      aria-label="Concord Guide"
      data-guide="guide-card"
      className="mx-3 mt-6 mb-4 border bg-card p-3.5"
    >
      <div className="flex items-center gap-2.5">
        <ClosingHeart value={overallProgress(progress, TUTORIAL_COUNT)} />
        <div className="min-w-0">
          <p className="text-sm leading-tight font-semibold">Concord Guide</p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {done
              ? `${done} of ${TUTORIAL_COUNT} finished`
              : `${TUTORIAL_COUNT} short tutorials`}
          </p>
        </div>
      </div>
      <p className="my-3 text-xs leading-relaxed text-muted-foreground">
        {done >= TUTORIAL_COUNT
          ? "You finished all the tutorials. You can repeat any of them."
          : paused
            ? "You have a paused tutorial. Open the Guide to continue."
            : "Learn every task step by step, in simple words."}
      </p>
      <Button
        className="w-full"
        onClick={() => {
          onOpen?.()
          openGuide()
        }}
      >
        Open Guide
      </Button>
    </section>
  )
}
