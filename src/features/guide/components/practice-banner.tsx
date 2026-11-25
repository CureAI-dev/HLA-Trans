import { Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { useGuide } from "../guide-store"

/** Says that a screen is for practice, and offers the way out when no tutorial is running. */
export function PracticeBanner() {
  const running = useGuide((s) => s.active !== null)
  return (
    <div
      role="note"
      className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 border border-dashed border-primary bg-accent px-3.5 py-2.5 text-[13px]"
    >
      <strong className="font-semibold">Practice screen</strong>
      <span>Synthetic records. Nothing here is saved.</span>
      {!running && (
        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          nativeButton={false}
          render={<Link to="/" />}
        >
          Back to the Dashboard
        </Button>
      )}
    </div>
  )
}
