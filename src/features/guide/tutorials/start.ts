import { g } from "../guide.types"
import type { Step, Tutorial } from "../guide.types"
import { PRACTICE_VALUES, explainResult } from "../practice"
import { pairTimes, textOf } from "./dom"

const dashboard = { to: "/" }
const blank = { to: "/matches/check", search: { practice: true } }
const filled = {
  to: "/matches/check",
  search: { practice: true, filled: true },
}
const times = [
  PRACTICE_VALUES.distanceNm,
  PRACTICE_VALUES.procurementMinutes,
  PRACTICE_VALUES.transportMinutes,
  PRACTICE_VALUES.implantMinutes,
]
const countFilled = () => pairTimes().filter(Boolean).length

const first: Tutorial = {
  id: "first",
  group: "start",
  name: "Your first match",
  summary: "Check one patient with one donor, from start to finish",
  keywords: "start begin new pass review fail",
  pages: ["/"],
  steps: [
    {
      at: dashboard,
      target: g("dashboard-counts"),
      side: "bottom",
      title: "This is the Dashboard",
      text: "It is the first page you see. The cards count the patients who are waiting for a heart and the donors whose hearts are available. <b>Pending decisions</b> counts the results that still need a decision from a clinician.",
    },
    {
      at: dashboard,
      target: g("dashboard-recent"),
      side: "left",
      title: "Concord compares records for you",
      text: "When you add a patient, Concord compares that patient with every available donor. When you add a donor, it compares that donor with every patient who is active on the waiting list. The newest results are listed here.",
    },
    {
      at: dashboard,
      target: g("dashboard-check"),
      side: "bottom",
      align: "end",
      title: "Let us check one pair together",
      text: "A pair means one patient and one donor. We will use practice records that are made up, so you can press anything without causing harm.",
      try: {
        text: "Press <b>Check a pair</b>.",
        nudge: "Please press the Check a pair button that is highlighted.",
        press: g("dashboard-check"),
      },
    },
    {
      at: blank,
      target: g("pair-picker"),
      side: "bottom",
      title: "The patient and the donor",
      text: "On the left is Maya Chen, a patient waiting for a heart. On the right is a donor with the ID AHFK214. Both have blood type O. In your daily work you search for them in these two boxes. For this practice they are already chosen.",
    },
    {
      at: blank,
      target: g("verdict"),
      side: "bottom",
      title: "The result and its six checks",
      text: "Concord does six checks on every pair. Each small box below is one check. The overall result is the most serious of the six, so one FAIL makes the whole pair FAIL.",
      legend: true,
    },
    {
      at: blank,
      target: g("missing-data"),
      side: "top",
      title: "Why this pair is REVIEW",
      text: "Four values are not filled in yet, so Concord cannot finish the last check. Concord never guesses a missing value and never treats it as normal. It asks a person to look, and that is what REVIEW means here.",
    },
    {
      at: blank,
      target: g("pair-times"),
      side: "right",
      title: "Fill in the four values",
      text: "The distance is in nautical miles (NM). The other three are times in minutes. You can type 180, 40, 90 and 60. You can also try your own numbers to see what happens.",
      try: {
        text: () => `${countFilled()} of 4 are filled in.`,
        done: "All four are filled in. Press Next to see what changed.",
        nudge: "Please fill in all four boxes first.",
        check: () => countFilled() === 4,
        fill: Object.fromEntries(
          times.map((v, i) => [
            `${g("pair-times")} > :nth-child(${i + 1}) input`,
            String(v),
          ])
        ),
      },
    },
    {
      at: filled,
      target: g("verdict"),
      side: "bottom",
      title: "REVIEW became PASS",
      text: "",
      dynamic: () => {
        const [distance, ...minutes] = pairTimes().map(Number)
        return explainResult({
          minutes: minutes.reduce((a, b) => a + b, 0),
          distanceNm: distance,
          overall: textOf(g("verdict-overall")).trim().toLowerCase(),
        })
      },
    },
    {
      at: filled,
      target: g("verdict"),
      side: "bottom",
      title: "Open a check to see the reason",
      text: "You can open any of the six checks to see why it passed, failed or needs a review.",
      try: {
        text: "Press the last box, <b>Ischemic time and logistics</b>.",
        nudge: "Please press the last box, Ischemic time and logistics.",
        press: g("check-logistics"),
      },
    },
    {
      at: filled,
      target: "#rule-logistics",
      side: "top",
      title: "Read the reason",
      text: "Each line first tells you the limit. Under it is the <b>evidence</b>, which means the exact values Concord used. Each line also shows the <b>source</b>. That is the policy, study or hospital rule the limit comes from.",
    },
    {
      at: filled,
      target: g("pair-save"),
      side: "top",
      title: "Saving the result",
      text: "In your daily work you press <b>Save match result</b> when the values are correct. Concord then keeps a copy that nobody can change. After that, a clinician reads it and records a decision. Concord only gives advice. The clinician always decides.",
    },
  ],
}

/** On a small screen the sidebar is closed, so these steps point at the menu button. */
const inMenu = (name: string): Pick<Step, "target" | "side"> => ({
  target: [g(name), g("nav-menu")],
  side: "right",
})

const around: Tutorial = {
  id: "around",
  group: "start",
  name: "Find your way around",
  summary: "What each part of the screen is for",
  keywords: "menu navigation theme dark light sign out sidebar",
  pages: ["/"],
  steps: [
    {
      at: dashboard,
      ...inMenu("nav-records"),
      title: "Dashboard, Patients and Donors",
      text: "<b>Patients</b> is the list of people waiting for a heart. <b>Donors</b> is the list of donors whose hearts are being offered. Everything else in Concord uses these two lists.",
    },
    {
      at: dashboard,
      ...inMenu("nav-matching"),
      title: "Matching, Match results and Check a pair",
      text: "<b>Matching</b> shows the comparisons that are running now and the ones that are finished. <b>Match results</b> keeps every result. <b>Check a pair</b> is where you check one patient with one donor yourself.",
    },
    {
      at: dashboard,
      ...inMenu("nav-settings"),
      title: "Criteria, Audit log and Data",
      text: "<b>Criteria</b> holds the limits that the checks use. <b>Audit log</b> is the list of who did what and when. <b>Data</b> is where you download records, bring in old records or load made-up practice records.",
    },
    {
      at: dashboard,
      target: g("run-indicator"),
      side: "bottom",
      align: "end",
      sampleRun: true,
      title: "When Concord is working",
      text: "While Concord compares records in the background, this button appears at the top of every page. Press it to see how far it has come. You can keep working while it runs.",
    },
    {
      at: dashboard,
      target: g("user-area"),
      side: "bottom",
      align: "end",
      title: "Your name",
      text: "Concord writes the name of the signed-in person on every record, result and decision. Please make sure it is your own name. The button next to it changes between light and dark colors.",
    },
    {
      at: dashboard,
      ...inMenu("guide-card"),
      title: "Where to find help",
      text: "Press <b>Open Guide</b> at any time to see all the tutorials. On a small screen it is in the menu. If you stop a tutorial before the end, Concord remembers the step you were on.",
    },
  ],
}

export const startTutorials = [first, around]
