import { g } from "../guide.types"
import type { Tutorial } from "../guide.types"

const matching = { to: "/matching", search: {} }
const run = { to: "/practice/run", search: {} }
const donor = { to: "/practice/donor", search: {} }

const follow: Tutorial = {
  id: "run",
  group: "matching",
  name: "Follow a match run",
  summary: "See what Concord is comparing and what it found",
  keywords: "progress cancel queued failed history running",
  pages: ["/matching", "/matching/$runId"],
  steps: [
    {
      at: matching,
      target: g("runs-active"),
      side: "bottom",
      title: "Match runs that are working now",
      text: "A match run is one round of comparisons. It starts by itself when you save a new patient or a new donor. While it works, you see it here with a bar that shows how many pairs are finished. You can leave this page and the run continues.",
    },
    {
      at: matching,
      target: g("run-cancel"),
      side: "bottom",
      optional: true,
      title: "Stop a run",
      text: "Press <b>Cancel</b> if a run should not continue, for example when you saved a record by mistake.",
    },
    {
      at: matching,
      target: g("run-filters"),
      side: "bottom",
      title: "Find an older run",
      text: "You can show only the runs with one status, only runs for patients or for donors, or only runs between two dates.",
    },
    {
      at: matching,
      target: g("run-row"),
      side: "bottom",
      optional: true,
      title: "A finished run",
      text: "Each row is one run. You can see who it was for, why it started, how long it took and who started it. Press the name to open the run.",
    },
    {
      at: matching,
      target: g("run-results"),
      side: "top",
      optional: true,
      title: "The three numbers",
      text: "The numbers are PASS, REVIEW and FAIL, always in that order. So <b>0 · 18 · 2</b> means no pair was PASS, 18 pairs were REVIEW and 2 pairs were FAIL.",
    },
    {
      at: matching,
      target: g("run-failed"),
      side: "top",
      optional: true,
      title: "A run that failed",
      text: "Failed here means that the run could not finish. It does not mean that the pairs failed. Open the record, press the three dots and choose <b>Rerun matching</b>. If it fails again, please tell your administrator.",
    },
    {
      at: run,
      target: g("run-tabs"),
      side: "bottom",
      title: "Inside one run",
      text: "When you open a run, you see every pair it compared. Use these tabs to see only the PASS, REVIEW or FAIL results.",
    },
  ],
}

const screening: Tutorial = {
  id: "screen",
  group: "matching",
  name: "Understand screening results",
  summary: "The order of the list and why nothing is PASS",
  keywords: "rank order blockers missing allocation optn screening",
  pages: ["/donors/$donorId", "/matching/$runId"],
  steps: [
    {
      at: donor,
      target: g("screening-note"),
      side: "bottom",
      title: "What screening means",
      text: "Screening is the first comparison, which Concord does by itself. The order of this list helps you to read it. It does not decide who receives the heart. The official order comes from OPTN, the United States organ allocation system.",
    },
    {
      at: donor,
      target: g("screening-table"),
      side: "top",
      title: "How the list is sorted",
      text: "The best result comes first. When results are equal, Concord looks at how urgent the patient is. After that it looks at child priority, at blood type priority, and at how long the patient has had the current status.",
    },
    {
      at: donor,
      target: g("screening-result"),
      side: "bottom",
      title: "Why you see REVIEW and not PASS",
      text: "During screening nobody knows the travel times yet. The last of the six checks cannot be finished, so a screening result is never PASS. This is normal. Look at the other five checks to learn about the pair.",
    },
    {
      at: donor,
      target: g("screening-blockers"),
      side: "bottom",
      title: "Blockers",
      text: "A blocker is a reason why this pair cannot be considered at all. For example, the patient is not active on the waiting list, or the donor is not available any more.",
    },
    {
      at: donor,
      target: g("screening-missing"),
      side: "bottom",
      title: "Missing",
      text: "This is the number of values that the checks need but that nobody has filled in yet. When you fill them in and check the pair again, the result becomes clearer.",
    },
    {
      at: donor,
      target: g("screening-check"),
      side: "left",
      title: "Check one of these pairs",
      text: "Press <b>Check this pair</b> to enter the travel times and the other missing values. The patient and the donor are already chosen for you.",
    },
  ],
}

export const matchingTutorials = [follow, screening]
