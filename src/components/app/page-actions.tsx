import { useState } from "react"
import { Link } from "@tanstack/react-router"
import type { LinkOptions } from "@tanstack/react-router"
import { MoreHorizontal, Pencil, RefreshCw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "@/components/ui/toast"

/** Toast after a rerun is queued; "View" opens the run's results. */
export function toastMatchingStarted(onView: () => void) {
  toast.add({
    title: "Matching started",
    description: "Results appear as pairs are processed.",
    actionProps: { children: "View", onClick: onView },
  })
}

/** Edit, Check a pair and a More menu (Rerun, Delete), on one baseline at equal height. */
export function RecordActions({
  editLink,
  checkLink,
  entityLabel,
  onRerun,
  rerunPending,
  onDelete,
  deletePending,
}: {
  editLink: LinkOptions
  checkLink: LinkOptions
  entityLabel: "patient" | "donor"
  onRerun: () => void
  rerunPending: boolean
  /** Resolves on success; the dialog stays open (and pending) until then. */
  onDelete: () => Promise<void>
  deletePending: boolean
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  return (
    <>
      <Button nativeButton={false} render={<Link {...editLink} />}>
        <Pencil aria-hidden="true" /> Edit {entityLabel}
      </Button>
      <Button variant="outline" nativeButton={false} render={<Link {...checkLink} />}>
        Check a pair
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" size="icon" aria-label="More actions" />}
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={onRerun} disabled={rerunPending}>
            <RefreshCw aria-hidden="true" /> Rerun matching
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setConfirmOpen(true)}>
            <Trash2 aria-hidden="true" /> Delete {entityLabel}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => !deletePending && setConfirmOpen(open)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this {entityLabel}?</AlertDialogTitle>
            <AlertDialogDescription>
              The {entityLabel} is removed from lists and future matching. Saved
              match results keep their snapshots.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePending}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={deletePending}
              onClick={() =>
                void onDelete().then(
                  () => setConfirmOpen(false),
                  () => undefined
                )
              }
            >
              {deletePending && <Spinner aria-hidden="true" />} Delete {entityLabel}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
