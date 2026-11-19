import { cn } from "@/lib/utils"

/** The two halves (donor, recipient) that close into one heart. Same paths as public/concord-symbol.svg. */
const HALF =
  "M51 36 C47 30 41 27 34.5 27 C24.5 27 19 35.5 19 46 C19 63 33 80 51 100"

/** Concord symbol in currentColor, so it follows the theme. Decorative: pair it with the name. */
export function ConcordMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="12 20 104 88"
      aria-hidden="true"
      className={cn("size-6 shrink-0", className)}
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="9.6"
        strokeLinecap="round"
      >
        <path d={HALF} />
        <path d={HALF} transform="translate(128 0) scale(-1 1)" />
      </g>
    </svg>
  )
}
