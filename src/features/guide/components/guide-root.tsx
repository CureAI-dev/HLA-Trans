import { Suspense, lazy, useCallback, useEffect, useState } from "react"
import { useRouter } from "@tanstack/react-router"
import { toast } from "@/components/ui/toast"
import { guideState, loadGuideUser, setGuide, useGuide } from "../guide-store"

const GuideDialog = lazy(() => import("./guide-dialog"))
const GuideNotice = lazy(() => import("./guide-notice"))

/** Mounted once in the app frame. The dialog, the tutorials and driver.js load on first use. */
export function GuideRoot({ userId }: { userId: string }) {
  const router = useRouter()
  const dialog = useGuide((s) => s.dialog)
  const notice = useGuide((s) => s.notice)
  const [used, setUsed] = useState({ dialog: false, notice: false })
  useEffect(() => {
    loadGuideUser(userId)
    if (!guideState().progress.seen) setGuide({ notice: "welcome" })
  }, [userId])
  useEffect(() => {
    if (dialog) setUsed((u) => ({ ...u, dialog: true }))
    if (notice) setUsed((u) => ({ ...u, notice: true }))
  }, [dialog, notice])

  const start = useCallback(
    (id: string, step: number) => {
      setGuide({ dialog: false, notice: null })
      import("../guide-runner").then(
        ({ startTutorial }) => startTutorial(router, id, step),
        () =>
          toast.add({
            title: "The tutorial could not be loaded",
            description: "Please check your connection and try again.",
          })
      )
    },
    [router]
  )
  return (
    <Suspense fallback={null}>
      {used.dialog && <GuideDialog onStart={start} />}
      {used.notice && <GuideNotice onStart={start} />}
    </Suspense>
  )
}
