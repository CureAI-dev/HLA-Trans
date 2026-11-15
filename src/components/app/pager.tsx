import { ChevronRight, ChevronsLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

/** Keyset paging is forward-only; Back in the browser returns to the previous page (each page is a URL). */
export function Pager({
  hasCursor,
  nextCursor,
  onFirst,
  onNext,
}: {
  hasCursor: boolean
  nextCursor: string | null
  onFirst: () => void
  onNext: (cursor: string) => void
}) {
  if (!hasCursor && !nextCursor) return null
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-end gap-2">
      {hasCursor && (
        <Button variant="outline" onClick={onFirst}>
          <ChevronsLeft aria-hidden="true" />
          First page
        </Button>
      )}
      {nextCursor && (
        <Button variant="outline" onClick={() => onNext(nextCursor)}>
          Next page
          <ChevronRight aria-hidden="true" />
        </Button>
      )}
    </nav>
  )
}
