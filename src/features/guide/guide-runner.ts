import { driver } from "driver.js"
import type { Driver, PopoverDOM } from "driver.js"
import type { AnyRouter } from "@tanstack/react-router"
import "driver.js/dist/driver.css"
import "./guide.css"
import { toast } from "@/components/ui/toast"
import { withDone, withPaused } from "./guide-progress"
import { openGuide, setGuide, updateProgress } from "./guide-store"
import { isPractice } from "./guide.types"
import type { Place, Step, Tutorial } from "./guide.types"
import { heartMarkup, moveHeart } from "./heart-shape"
import { TUTORIALS, tutorialById } from "./tutorials"
import { type as typeInto } from "./tutorials/dom"

/** driver.js draws the highlight and the card; this module decides what is shown, where and when. */

const NARROW = 640
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms))
const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches
const sorted = (o: Record<string, unknown>) =>
  JSON.stringify(
    Object.entries(o)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
  )

const LEGEND = `<div class="cg-legend"><span class="cg-pass">PASS</span><span>Nothing needs attention.</span><span class="cg-review">REVIEW</span><span>A clinician must look at this.</span><span class="cg-fail">FAIL</span><span>A value is outside the limit.</span></div>`

/** Where to go when a tutorial ends on a practice screen. */
const AFTER_PRACTICE: Record<string, string> = {
  "/matches/check": "/matches/check",
  "/patients/new": "/patients",
  "/donors/new": "/donors",
  "/practice/patient": "/patients",
  "/practice/donor": "/donors",
  "/practice/run": "/matching",
  "/practice/result": "/matches",
}

let running: { stop: () => void } | null = null

export function startTutorial(router: AnyRouter, id: string, from = 0): void {
  running?.stop()
  const tutorial = tutorialById(id)
  if (!tutorial) return
  const session = createSession(router, tutorial)
  running = session
  void session.show(Math.min(from, tutorial.steps.length - 1), 1)
}

const isVisible = (el: Element) => {
  const box = el.getBoundingClientRect()
  return (
    box.width > 0 &&
    box.height > 0 &&
    getComputedStyle(el).visibility !== "hidden"
  )
}

function findTarget(step: Step): Element | undefined {
  const selectors =
    typeof step.target === "string" ? [step.target] : step.target
  for (const selector of selectors) {
    const el = [...document.querySelectorAll(selector)].find(isVisible)
    if (el) return el
  }
  return undefined
}

async function waitForTarget(step: Step, ms: number, over: () => boolean) {
  const end = Date.now() + ms
  let last: string | undefined
  for (;;) {
    const el = findTarget(step)
    if (el) {
      // Two equal readings: the page has settled.
      const { top, left, width, height } = el.getBoundingClientRect()
      const now = [top, left, width, height].join()
      if (now === last) return el
      last = now
    }
    if (over() || Date.now() > end) return el
    await sleep(60)
  }
}

function createSession(router: AnyRouter, tutorial: Tutorial) {
  const { steps } = tutorial
  let index = -1
  let over = false
  /** Moving between steps: ignore presses and route changes. */
  let busy = false
  // A call, so the compiler knows it can change while a step is being prepared.
  const isOver = () => over
  let timer: ReturnType<typeof setInterval> | undefined
  let card: PopoverDOM | undefined
  let started = false

  const d: Driver = driver({
    animate: !reducedMotion(),
    duration: 250,
    smoothScroll: false,
    scrollIntoView: false, // done here, so tall targets and phones are handled
    overlayColor: "#0a1c26",
    overlayOpacity: 0.58,
    stagePadding: 8,
    stageRadius: 0,
    popoverOffset: 14,
    popoverClass: "cg",
    overlayClickBehavior: "none",
    focus: "none",
    showButtons: ["next", "previous", "close"],
    nextBtnText: "Next",
    prevBtnText: "Back",
    doneBtnText: "Finish",
    closeBtnLabel: "Pause the tutorial",
    // The target is found again here; a page change must not move or end the tutorial by itself.
    onElementMissing: () => false,
    steps: steps.map((step) => ({
      element: () => findTarget(step) as Element,
      disableActiveInteraction: !step.try,
      allowedElements: step.try?.allow
        ? () => [...document.querySelectorAll(step.try?.allow ?? "x")]
        : undefined,
      popover: {
        title: step.title,
        description: step.text || " ",
        side: step.side,
        align: step.align ?? "center",
      },
    })),
    onPopoverRender: (popover, { index: at = 0 }) => draw(popover, at),
    onHighlighted: () => settled(),
    onNextClick: () => next(),
    onDoneClick: () => next(),
    onPrevClick: () => {
      if (!busy && index > 0) void show(index - 1, -1)
    },
    onCloseClick: () => pause(),
    onDestroyStarted: () => pause(),
  })

  function draw(popover: PopoverDOM, at: number) {
    const step = steps[at]
    card = popover
    if (step.dynamic) {
      const { title, text } = step.dynamic()
      popover.title.innerHTML = title
      popover.description.innerHTML = text
    }
    if (step.legend) popover.description.insertAdjacentHTML("beforeend", LEGEND)
    popover.wrapper.querySelector(".cg-top")?.remove()
    const top = document.createElement("div")
    top.className = "cg-top"
    top.innerHTML = `${heartMarkup(at / steps.length)}<span>Step ${at + 1} of ${steps.length}</span>${isPractice(step) ? "<em>Practice, not saved</em>" : ""}`
    popover.wrapper.insertBefore(top, popover.wrapper.firstChild)
    popover.wrapper.tabIndex = -1
    popover.previousButton.style.display = at === 0 ? "none" : ""
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        moveHeart(top.querySelector(".cg-heart"), (at + 1) / steps.length)
      )
    )
    if (step.try) {
      const row = document.createElement("div")
      row.className = "cg-try"
      row.setAttribute("role", "status")
      row.appendChild(document.createElement("span"))
      popover.description.appendChild(row)
    }
    paint(step)
  }

  const isDone = (step: Step): boolean =>
    !step.try || (step.try.check?.() ?? false)

  /** The "try it" row and the Next button follow what the operator did. */
  function paint(step: Step) {
    const wrapper = card?.wrapper
    const todo = step.try
    if (!wrapper) return
    const done = isDone(step)
    wrapper.classList.toggle("cg-waiting", !done)
    const row = wrapper.querySelector<HTMLElement>(".cg-try")
    const label = row?.querySelector("span")
    if (!todo || !row || !label) return
    row.classList.toggle("cg-done", done && Boolean(todo.done))
    const text = typeof todo.text === "function" ? todo.text() : todo.text
    const html =
      done && todo.done
        ? todo.done
        : `${text}${todo.fill ? ' <button type="button">Fill them in for me</button>' : ""}`
    if (row.dataset.html === html) return
    row.dataset.html = html
    label.innerHTML = html
    label
      .querySelector("button")
      ?.addEventListener("click", () => void fill(todo.fill ?? {}))
    if (started) d.refresh()
  }

  async function fill(values: Record<string, string>) {
    for (const [selector, text] of Object.entries(values)) {
      if (over) return
      typeInto(selector, text)
      await sleep(reducedMotion() ? 0 : 300)
    }
  }

  function watch(step: Step) {
    clearInterval(timer)
    if (!step.try) return
    timer = setInterval(() => {
      if (busy || over) return
      paint(step)
      if (step.try?.auto && isDone(step)) void show(index + 1, 1)
    }, 150)
  }

  function onPress(event: MouseEvent) {
    const press = index >= 0 ? steps[index].try?.press : undefined
    if (!press || busy || over || !(event.target instanceof Element)) return
    const link = event.target.closest(press)
    if (!link) return
    // The next step names its own place, so a link must not navigate on its own.
    if (link instanceof HTMLAnchorElement) event.preventDefault()
    busy = true
    setTimeout(() => void show(index + 1, 1), 180)
  }

  /** driver.js leaves Escape to inputs; here it always pauses unless it closes an open list. */
  function onKey(event: KeyboardEvent) {
    if (
      event.key === "Escape" &&
      event.target instanceof HTMLElement &&
      event.target.matches("input, textarea") &&
      !document.querySelector('[data-slot="select-content"]')
    )
      pause()
  }

  const unsubscribe = router.subscribe("onResolved", ({ toLocation }) => {
    if (
      !busy &&
      !over &&
      index >= 0 &&
      toLocation.pathname !== steps[index].at.to
    )
      pause(true)
  })

  /** Resolves to false when the app stayed where it was (unsaved changes kept). */
  async function goTo(place: Place): Promise<boolean> {
    const { location } = router.state
    const same =
      location.pathname === place.to &&
      (!place.search || sorted(location.search) === sorted(place.search))
    if (same) return true
    const samePath = location.pathname === place.to
    void router.navigate({
      to: place.to,
      search: place.search ?? {},
      replace: samePath,
      resetScroll: !samePath,
    })
    const deadline = Date.now() + 10_000
    for (;;) {
      const at = router.state
      if (
        at.status === "idle" &&
        at.location.pathname === place.to &&
        (!place.search || sorted(at.location.search) === sorted(place.search))
      )
        return true
      // The "Discard unsaved changes?" dialog: wait for the answer.
      const asking = document.querySelector('[role="alertdialog"]') !== null
      if (over || (!asking && Date.now() > deadline)) return false
      await sleep(50)
    }
  }

  async function show(to: number, direction: 1 | -1): Promise<void> {
    if (over) return
    if (to >= steps.length) return finish()
    if (to < 0) {
      busy = false
      return
    }
    busy = true
    clearInterval(timer)
    const step = steps[to]
    setGuide({ active: tutorial.id, sampleRun: Boolean(step.sampleRun) })
    // A closing dialog still holds the focus and covers the page.
    while (document.querySelector('[data-slot="dialog-content"]'))
      await sleep(40)
    if (!(await goTo(step.at))) return end()
    const el = await waitForTarget(
      step,
      step.optional ? 900 : 5_000,
      () => over
    )
    if (isOver()) return
    if (!el && step.optional) return show(to + direction, direction)
    step.before?.()
    if (el) reveal(el)
    index = to
    if (started) d.moveTo(to)
    else d.drive(to)
    started = true
    watch(step)
    busy = false
  }

  /** Runs when a step is fully shown. */
  function settled() {
    if (over) return
    const wrapper = card?.wrapper
    const el = index >= 0 ? findTarget(steps[index]) : undefined
    if (el && wrapper && window.innerWidth <= NARROW) {
      // The sheet adds room to scroll, so a low target can move up now. One that stays at the
      // bottom, such as the sticky form buttons, sends the sheet to the top instead.
      reveal(el)
      wrapper.classList.toggle(
        "cg-dock-top",
        el.getBoundingClientRect().top > window.innerHeight * 0.6
      )
      d.refresh()
    }
    // The card takes the focus, so screen readers read it and no control lights up.
    if (!el?.contains(document.activeElement))
      wrapper?.focus({ preventScroll: true })
  }

  function reveal(el: Element) {
    const box = el.getBoundingClientRect()
    const phone = window.innerWidth <= NARROW
    const tall = box.height > window.innerHeight * 0.45
    if (!phone && box.top >= 70 && box.bottom <= window.innerHeight - 40) return
    el.scrollIntoView({
      block: phone || tall ? "start" : "center",
      inline: "nearest",
      behavior: "instant",
    })
  }

  function next() {
    if (busy || over) return
    const step = steps[index]
    if (!isDone(step)) return d.nudge(step.try?.nudge ?? "")
    void show(index + 1, 1)
  }

  function end() {
    if (over) return
    over = true
    if (running === session) running = null
    clearInterval(timer)
    unsubscribe()
    document.removeEventListener("click", onPress, true)
    window.removeEventListener("keydown", onKey, true)
    d.destroy()
    setGuide({ active: null, sampleRun: false })
  }

  function leavePractice(to?: string) {
    const { location } = router.state
    const target =
      to ??
      (location.pathname.startsWith("/practice/") || location.search.practice
        ? AFTER_PRACTICE[location.pathname]
        : undefined)
    if (target) void router.navigate({ to: target, search: {}, replace: true })
  }

  function pause(stay = false) {
    if (over) return
    const at = Math.max(index, 0)
    end()
    updateProgress((p) => withPaused(p, tutorial.id, at, steps.length))
    if (!stay) leavePractice()
    toast.add({
      title: `Paused: ${tutorial.name}`,
      description: `You stopped at step ${at + 1} of ${steps.length}.`,
      actionProps: {
        children: "Resume",
        onClick: () => startTutorial(router, tutorial.id, at),
      },
    })
  }

  function finish() {
    end()
    updateProgress((p) => withDone(p, tutorial.id))
    if (tutorial.id === "first") {
      leavePractice("/")
      setGuide({ notice: "finished" })
      return
    }
    leavePractice()
    const following = TUTORIALS[TUTORIALS.indexOf(tutorial) + 1] as
      Tutorial | undefined
    toast.add({
      title: `Finished: ${tutorial.name}`,
      description: following
        ? `Next: ${following.name}`
        : "Open the Guide to see the other tutorials.",
      actionProps: following
        ? {
            children: "Start next",
            onClick: () => startTutorial(router, following.id),
          }
        : { children: "Open Guide", onClick: openGuide },
    })
  }

  document.addEventListener("click", onPress, true)
  window.addEventListener("keydown", onKey, true)
  const session = { show, stop: end }
  return session
}
