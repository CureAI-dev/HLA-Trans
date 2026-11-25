import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { withSeen } from "../guide-progress"
import { openGuide, setGuide, updateProgress, useGuide } from "../guide-store"
import { ClosingHeart } from "./closing-heart"

const close = () => {
  setGuide({ notice: null })
  updateProgress(withSeen)
}

/** The welcome card, once per user, and the card after the first tutorial. */
export default function GuideNotice({
  onStart,
}: {
  onStart: (id: string, step: number) => void
}) {
  const notice = useGuide((s) => s.notice)
  // Keeps the text while the dialog fades out.
  const [shown, setShown] = useState(notice)
  useEffect(() => {
    if (notice) setShown(notice)
  }, [notice])
  const popup = useRef<HTMLDivElement>(null)
  const finished = shown === "finished"
  const [value, setValue] = useState(0.28)
  useEffect(() => {
    if (notice !== "finished") return setValue(0.28)
    setValue(0.5)
    const timer = setTimeout(() => setValue(1), 150)
    return () => clearTimeout(timer)
  }, [notice])
  return (
    <Dialog open={notice !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent
        ref={popup}
        tabIndex={-1}
        initialFocus={popup}
        className="gap-0 p-6 sm:max-w-[470px] sm:p-9"
      >
        <ClosingHeart
          value={value}
          beat={finished && value === 1}
          className="w-24"
        />
        <DialogTitle className="mt-5 mb-2.5 text-2xl leading-tight font-semibold tracking-tight text-balance">
          {finished
            ? "You just checked your first pair"
            : "Welcome to Concord. Shall we check your first pair together?"}
        </DialogTitle>
        <DialogDescription className="max-w-[44ch] text-[15px] leading-relaxed">
          {finished
            ? "Well done. You read the six checks, filled in the missing values and saw the reason for the result. Nothing was saved. You can find more tutorials in the menu on the left. Press Open Guide."
            : "It takes about four minutes. We will use practice records that are made up. Nothing you do is saved, so you cannot break anything."}
        </DialogDescription>
        <div className="mt-6 flex flex-wrap gap-2.5">
          <Button
            className="h-10 px-4 text-sm"
            onClick={() => {
              close()
              if (!finished) onStart("first", 0)
            }}
          >
            {finished ? "Start using Concord" : "Yes, show me"}
          </Button>
          <Button
            variant="outline"
            className="h-10 px-4 text-sm"
            onClick={() => {
              close()
              if (finished) openGuide()
            }}
          >
            {finished ? "See all tutorials" : "No, thank you. Later"}
          </Button>
        </div>
        {!finished && (
          <p className="mt-5 border-t pt-3.5 text-[12.5px] text-muted-foreground">
            You can find all the tutorials in the menu. Press Open Guide.
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
