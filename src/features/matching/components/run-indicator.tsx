import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Loader2 } from "lucide-react"
import { matchingQueries } from "../matching.queries"
import { RunProgressCard } from "./run-progress-card"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"

const SHOWN = 5

/** Header control; hidden when nothing is running. Shares the polled `active` query. */
export function RunIndicator() {
  const { data: runs = [] } = useQuery(matchingQueries.active())
  if (!runs.length) return null
  const label = `${runs.length} matching ${runs.length === 1 ? "run" : "runs"} in progress`
  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="outline" size="sm" aria-label={label} />}
      >
        <Loader2 className="animate-spin" aria-hidden="true" />
        <span className="tabular-nums">{runs.length}</span> matching
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 max-w-[calc(100vw-2rem)]">
        <PopoverTitle>{label}</PopoverTitle>
        {runs.slice(0, SHOWN).map((run) => (
          <RunProgressCard key={run.id} run={run} />
        ))}
        {runs.length > SHOWN && (
          <p className="text-muted-foreground">
            And {runs.length - SHOWN} more.
          </p>
        )}
        <Button
          variant="link"
          size="sm"
          className="self-start px-0"
          nativeButton={false}
          render={<Link to="/matching" />}
        >
          All matching runs
        </Button>
      </PopoverContent>
    </Popover>
  )
}
