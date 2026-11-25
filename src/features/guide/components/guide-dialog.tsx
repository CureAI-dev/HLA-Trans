import { useMemo, useRef, useState } from "react"
import { useRouterState } from "@tanstack/react-router"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { ScrollArea } from "@/components/ui/scroll-area"
import { GROUPS } from "../guide-meta"
import { overallProgress, tutorialProgress } from "../guide-progress"
import type { GuideProgress } from "../guide-progress"
import { setGuide, useGuide } from "../guide-store"
import type { Tutorial } from "../guide.types"
import {
  TUTORIALS,
  minutesOf,
  searchTutorials,
  tutorialById,
  tutorialForPage,
} from "../tutorials"
import { ClosingHeart } from "./closing-heart"
import { Doctor } from "./doctor"

type Start = (id: string, step: number) => void

const resumeStep = (p: GuideProgress, id: string): number =>
  (p.paused[id] as GuideProgress["paused"][string] | undefined)?.step ?? 0

/** One suggestion: the paused tutorial, else the first one, else the one for this page. */
function suggestion(p: GuideProgress, pathname: string) {
  const paused = TUTORIALS.find((t) => resumeStep(p, t.id) > 0)
  if (paused)
    return {
      tutorial: paused,
      label: "You paused this tutorial",
      action: `Resume at step ${resumeStep(p, paused.id) + 1}`,
    }
  const first = tutorialById("first")
  if (first && !p.done.includes("first"))
    return {
      tutorial: first,
      label: "New to Concord? Start here",
      action: "Start",
    }
  const here = tutorialForPage(pathname, p.done)
  return here
    ? { tutorial: here, label: "For the page you are on", action: "Start" }
    : null
}

function TutorialButton({
  tutorial: t,
  progress,
  onStart,
}: {
  tutorial: Tutorial
  progress: GuideProgress
  onStart: Start
}) {
  const step = resumeStep(progress, t.id)
  const done = progress.done.includes(t.id)
  return (
    <button
      type="button"
      onClick={() => onStart(t.id, step)}
      className="grid size-full grid-cols-[2rem_minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 border bg-card px-3.5 py-3 text-left transition-colors hover:border-primary hover:bg-accent"
    >
      <ClosingHeart
        value={tutorialProgress(progress, t.id)}
        className="row-span-2 mt-0.5 w-7"
      />
      <span className="text-sm font-semibold">{t.name}</span>
      <span
        className={
          done || step
            ? "text-xs font-medium whitespace-nowrap text-primary"
            : "text-xs whitespace-nowrap text-muted-foreground tabular-nums"
        }
      >
        {done
          ? "Finished"
          : step
            ? `Resume step ${step + 1}`
            : `${t.steps.length} steps, ${minutesOf(t)} min`}
      </span>
      <span className="col-span-2 text-[13px] leading-snug text-muted-foreground">
        {t.summary}
      </span>
    </button>
  )
}

export default function GuideDialog({ onStart }: { onStart: Start }) {
  const open = useGuide((s) => s.dialog)
  const progress = useGuide((s) => s.progress)
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const popup = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState("")
  const found = useMemo(() => searchTutorials(query), [query])
  const suggested = query.trim() ? null : suggestion(progress, pathname)
  const done = progress.done.length
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => setGuide({ dialog: next })}
      onOpenChangeComplete={(next) => {
        if (!next) setQuery("")
      }}
    >
      <DialogContent
        ref={popup}
        tabIndex={-1}
        // Focus the dialog, not the search box: nothing lights up before it is pressed.
        initialFocus={popup}
        className="flex max-h-[calc(100dvh-3rem)] flex-col gap-0 border-t-2 border-t-primary p-0 max-md:h-dvh max-md:max-h-dvh max-md:max-w-none sm:max-w-[calc(100%-2rem)] md:max-w-[920px]"
      >
        <header className="grid shrink-0 grid-cols-[minmax(0,1fr)_6.5rem] items-end gap-x-3 bg-accent px-4 md:grid-cols-[minmax(0,1fr)_11.75rem] md:gap-x-5 md:px-6">
          <div className="self-center py-5 md:py-6">
            <DialogTitle className="text-xl font-semibold tracking-tight md:text-2xl">
              Concord Guide
            </DialogTitle>
            <DialogDescription className="mt-2 max-w-[52ch] text-[13.5px] leading-relaxed text-foreground md:text-[14.5px]">
              Choose a task below. I will show you each step on the real screen,
              in simple words. You cannot break anything, because nothing is
              saved, deleted or published.
            </DialogDescription>
            <p className="mt-3.5 flex items-center gap-2.5 text-[13px] font-medium tabular-nums">
              <ClosingHeart
                value={overallProgress(progress, TUTORIALS.length)}
                className="w-7"
              />
              {done} of {TUTORIALS.length} tutorials finished
            </p>
          </div>
          <Doctor className="mt-3.5 block w-full" />
        </header>
        <div className="shrink-0 border-b px-4 py-3 md:px-6 md:py-4">
          <InputGroup className="h-11 bg-card">
            <InputGroupAddon align="inline-start" className="pl-3">
              <Search aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              aria-label="Search the tutorials"
              placeholder="Search the tutorials, for example: decision or donor"
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-full text-sm md:text-sm"
            />
          </InputGroup>
        </div>
        <ScrollArea
          className="flex-1"
          viewportProps={{ className: "overscroll-contain" }}
          contentClassName="space-y-6 px-4 pt-4 pb-6 md:px-6"
        >
          {suggested && (
            <section className="flex flex-wrap items-center gap-x-4 gap-y-3 bg-accent px-4 py-3.5">
              <div className="flex-[1_1_15rem]">
                <p className="text-[13px] text-muted-foreground">
                  {suggested.label}
                </p>
                <p className="text-[15px] font-semibold">
                  {suggested.tutorial.name}
                </p>
              </div>
              <Button
                size="lg"
                className="px-4 text-[13px]"
                onClick={() =>
                  onStart(
                    suggested.tutorial.id,
                    resumeStep(progress, suggested.tutorial.id)
                  )
                }
              >
                {suggested.action}
              </Button>
            </section>
          )}
          {GROUPS.map((group) => {
            const list = found.filter((t) => t.group === group.id)
            if (!list.length) return null
            const finished = list.filter((t) =>
              progress.done.includes(t.id)
            ).length
            return (
              <section key={group.id} aria-labelledby={`guide-${group.id}`}>
                <div className="mb-2 flex justify-between gap-3 text-[13px]">
                  <h3 id={`guide-${group.id}`} className="font-semibold">
                    {group.title}
                  </h3>
                  <span className="text-muted-foreground tabular-nums">
                    {finished} of {list.length} finished
                  </span>
                </div>
                <ul className="grid gap-2 md:grid-cols-2">
                  {list.map((t) => (
                    <li key={t.id}>
                      <TutorialButton
                        tutorial={t}
                        progress={progress}
                        onStart={onStart}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
          {!found.length && (
            <p role="status" className="py-5 text-sm text-muted-foreground">
              No tutorial matches “{query.trim()}”. Please try another word,
              such as donor or result.
            </p>
          )}
        </ScrollArea>
        <p className="shrink-0 border-t px-4 py-3 text-xs text-muted-foreground max-md:hidden md:px-6">
          Press Esc to pause a tutorial. Concord remembers your step on this
          computer.
        </p>
      </DialogContent>
    </Dialog>
  )
}
