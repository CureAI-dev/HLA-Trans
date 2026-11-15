import { useState } from "react"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { actions, useDb, latestCriteria } from "@/lib/storage/db"
import { DonorSummary } from "@/components/donor/donor-summary"
import { ScreeningTable } from "@/components/donor/screening-table"
import { screenDonor } from "@/domain/engine"
import { PageHeader } from "@/components/app/page-header"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog"

export const Route = createFileRoute("/donors/$donorId/")({
  component: DonorDetail,
})
function DonorDetail() {
  const { donorId } = Route.useParams()
  const db = useDb()
  const donor = db.donors.find((d) => d.id === donorId)
  const navigate = useNavigate()
  const [tab, setTab] = useState("summary")
  const [error, setError] = useState("")
  if (!donor)
    return (
      <p>
        Donor not found. <Link to="/donors">Return to donors</Link>
      </p>
    )
  function remove() {
    try {
      actions.deleteDonor(donorId)
      toast.add({ title: "Donor deleted" })
      void navigate({ to: "/donors" })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to delete donor.")
    }
  }
  return (
    <>
      <PageHeader
        title={donor.identity.donorId}
        description={`${donor.identity.donorHospital || "Hospital not recorded"} · ${donor.identity.state}`}
        actions={
          <>
            <Link
              to="/donors/$donorId/edit"
              params={{ donorId: donor.id }}
              className="border px-3 py-2"
            >
              Edit donor
            </Link>
            <AlertDialog>
              <AlertDialogTrigger render={<Button variant="outline" />}>
                Delete donor
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this donor?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The donor record will be deleted. Existing saved match
                    results remain available.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={remove}>
                    Delete donor
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        }
      />
      {error && <p role="alert">{error}</p>}
      <div role="tablist" aria-label="Donor views" className="mb-4 flex gap-2">
        {[
          ["summary", "Summary"],
          ["screen", "Screen candidates"],
        ].map(([id, title]) => (
          <Button
            key={id}
            id={`tab-${id}`}
            role="tab"
            aria-controls={`panel-${id}`}
            aria-selected={tab === id}
            tabIndex={tab === id ? 0 : -1}
            onKeyDown={(event) => {
              if (
                !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              )
                return
              event.preventDefault()
              const next =
                event.key === "Home"
                  ? "summary"
                  : event.key === "End"
                    ? "screen"
                    : tab === "summary"
                      ? "screen"
                      : "summary"
              setTab(next)
              document.getElementById(`tab-${next}`)?.focus()
            }}
            variant={tab === id ? "default" : "outline"}
            onClick={() => setTab(id)}
          >
            {title}
          </Button>
        ))}
      </div>
      <div
        role="tabpanel"
        tabIndex={0}
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
      >
        {tab === "summary" ? (
          <DonorSummary donor={donor} />
        ) : (
          <ScreeningTable
            donor={donor}
            rows={screenDonor(donor, db.patients, latestCriteria(db).criteria)}
          />
        )}
      </div>
    </>
  )
}
