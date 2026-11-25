import { cn } from "@/lib/utils"
import {
  HEART_HALF,
  HEART_MIRROR,
  HEART_VIEW_BOX,
  heartGap,
} from "../heart-shape"

/** Progress as the Concord symbol: the two halves draw in and meet at 1. Decorative. */
export function ClosingHeart({
  value,
  beat = false,
  className,
}: {
  /** 0 to 1. */
  value: number
  beat?: boolean
  className?: string
}) {
  const halves = [
    { gap: -heartGap(value), transform: undefined },
    { gap: heartGap(value), transform: HEART_MIRROR },
  ]
  return (
    <svg
      viewBox={HEART_VIEW_BOX}
      aria-hidden="true"
      className={cn(
        "w-8 shrink-0 overflow-visible text-primary",
        beat && "origin-center animate-[guide-beat_1.1s_0.35s_ease-in-out_1]",
        className
      )}
    >
      {halves.map((half, i) => (
        <g
          key={i}
          className="transition-transform duration-500 ease-out"
          style={{ transform: `translateX(${half.gap}px)` }}
        >
          <g
            transform={half.transform}
            fill="none"
            stroke="currentColor"
            strokeWidth="9.6"
            strokeLinecap="round"
          >
            <path d={HEART_HALF} className="opacity-20" />
            {value > 0 && (
              <path
                d={HEART_HALF}
                pathLength={1}
                className="transition-[stroke-dashoffset] duration-500 ease-out [stroke-dasharray:1_2]"
                style={{ strokeDashoffset: 1 - value }}
              />
            )}
          </g>
        </g>
      ))}
    </svg>
  )
}
