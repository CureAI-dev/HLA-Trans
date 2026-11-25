import { g } from "../guide.types"
import type { Tutorial } from "../guide.types"
import { exists, textOf } from "./dom"

const result = (search: Record<string, unknown> = {}) => ({
  to: "/practice/result",
  search,
})
const check = { to: "/matches/check", search: { practice: true } }
const checked = { mode: "checked" }
const stale = { mode: "checked", ood: true }
const matches = { to: "/matches", search: {} }
const filter = (label: string) => `[role="search"] [aria-label="${label}"]`

const read: Tutorial = {
  id: "result",
  group: "results",
  name: "Read a match result",
  summary: "What the result says, why, and what is missing",
  keywords: "verdict chips findings evidence frozen compare source",
  pages: ["/matches/$matchId", "/matches"],
  steps: [
    {
      at: result(),
      target: g("verdict"),
      side: "bottom",
      title: "The result is at the top",
      text: "First you see PASS, REVIEW or FAIL for the whole pair. Below it there is one small box for each of the six checks. The most serious check decides the overall result.",
    },
    {
      at: result(),
      target: g("checks"),
      side: "bottom",
      title: "Go to one check",
      text: "Press a box to go to the details of that check. A question mark in a box means that a value is missing.",
      try: {
        text: "Press the <b>Size</b> box.",
        nudge: "Please press the Size box.",
        press: g("check-size"),
      },
    },
    {
      at: result(),
      target: "#rule-size",
      side: "top",
      title: "The reason for the result",
      text: "This check compares the size of the two hearts. <b>PHM ratio</b> is the estimated weight of the donor's heart divided by the estimated weight of the patient's heart. <b>Evidence</b> shows the numbers that were used.",
    },
    {
      at: result(),
      target: g("missing-data"),
      side: "bottom",
      title: "What still needs to be filled in",
      text: "Each row is one missing value and the check that needs it. The link on the right takes you to the place where you can fill it in.",
    },
    {
      at: result(),
      target: g("result-tabs"),
      side: "bottom",
      title: "The other tabs",
      text: "You can also see both people next to each other, or see the travel times that were used.",
      try: {
        text: "Press <b>Patient vs donor</b>.",
        nudge: "Please press Patient vs donor.",
        press: g("tab-compare"),
      },
    },
    {
      at: result({ tab: "compare" }),
      target: g("side-by-side"),
      side: "top",
      title: "Patient and donor together",
      text: "The same values of both people are in two columns. This is useful when you discuss a pair with your team.",
    },
    {
      at: result(),
      target: g("result-frozen"),
      side: "bottom",
      title: "A saved result does not change",
      text: "Concord keeps the records, the pair inputs and the limits exactly as they were when the result was saved. You can also see when it was saved and by whom.",
    },
    {
      at: result(),
      target: g("decision"),
      side: "left",
      title: "No decision here yet",
      text: "This is a screening result, so a clinician cannot record a decision on it. First press <b>Complete this match</b>, fill in the missing values and save. Then the decision form appears.",
    },
  ],
}

const checkPair: Tutorial = {
  id: "check",
  group: "results",
  name: "Check a pair",
  summary: "What every box on this page means",
  keywords: "ischemic crossmatch preservation distance transport perfusion",
  pages: ["/matches/check"],
  steps: [
    {
      at: check,
      target: g("pair-picker"),
      side: "bottom",
      title: "Choose the patient and the donor",
      text: "Type a name, a medical record number or a donor ID, press Enter and choose from the list. If you came here from a screening list, both are already chosen.",
    },
    {
      at: check,
      target: g("pair-times"),
      side: "right",
      title: "Distance and times",
      text: "Distance is how far the donor hospital is. Procurement and packaging, transport, and implant are three separate times in minutes. Leave a box empty if you do not know the value. If the patient has had heart surgery or has a heart device, do not add extra time. Concord adds it for you.",
    },
    {
      at: check,
      target: g("pair-preservation"),
      side: "right",
      title: "How the heart is kept",
      text: "Choose how the heart is kept during transport, for example on ice. Normothermic perfusion means a machine keeps the heart warm and supplied with blood. Type those minutes only if that machine is used. Concord then takes them off the time without blood flow.",
    },
    {
      at: check,
      target: g("pair-crossmatch"),
      side: "right",
      title: "Crossmatch tests",
      text: "A crossmatch is a laboratory test. It shows whether the patient's antibodies react with the donor's cells. Please choose the result you have. If a test was positive, never leave it as <b>Not done</b>, because Concord cannot warn you about a result it does not know.",
    },
    {
      at: check,
      target: g("verdict"),
      side: "bottom",
      title: "The result changes while you type",
      text: "Concord works out the result again after every change. Nothing is saved at this point. Read each check that is REVIEW or FAIL before you continue.",
    },
    {
      at: check,
      target: g("pair-save"),
      side: "top",
      title: "Save the result",
      text: "When you press <b>Save match result</b>, Concord works it out one more time from the saved records and keeps a copy. Then it opens the saved result, where a clinician can record the decision.",
    },
  ],
}

const decide: Tutorial = {
  id: "decide",
  group: "results",
  name: "Record a decision",
  summary: "Accept, decline or defer, step by step",
  keywords: "accept decline defer rationale acknowledge clinician final",
  pages: ["/matches/$matchId"],
  steps: [
    {
      at: result(checked),
      target: g("decision"),
      side: "left",
      title: "The decision form",
      text: "This form appears only on a result that a person checked and saved. A screening result does not have it. The form starts on <b>Defer</b>, which means more information is needed before a decision.",
    },
    {
      at: result(checked),
      target: g("decision-verdict"),
      side: "left",
      title: "Choose the decision",
      text: "The choices are accept the offer, decline the offer, or defer. Concord only gives advice. A clinician may accept a pair even when the result is FAIL, and explains why in the rationale.",
      try: {
        text: "Choose <b>Decline offer</b>.",
        done: "Well done. Reasons for declining now appear further down.",
        nudge: "Please change Decision to Decline offer.",
        check: () => /decline/i.test(textOf(g("decision-verdict") + " button")),
        allow: ":has(> [data-slot='select-content'])",
      },
    },
    {
      at: result({ ...checked, verdict: "decline" }),
      target: g("decision-reasons"),
      side: "left",
      title: "The reason for declining",
      text: "When you decline, you must tick at least one reason. Tick every reason that is true.",
      try: {
        text: "Tick one reason.",
        done: "Well done. You can tick more than one.",
        nudge: "Please tick at least one reason.",
        check: () => exists(`${g("decision-reasons")} [data-checked]`),
      },
    },
    {
      at: result({ ...checked, verdict: "decline" }),
      target: g("decision-clinician"),
      side: "left",
      title: "Who made the decision",
      text: "This box starts with your own name. If another clinician made the decision and you are only recording it, type the name of that clinician.",
    },
    {
      at: result({ ...checked, verdict: "decline" }),
      target: g("decision-rationale"),
      side: "left",
      title: "The rationale",
      text: "Rationale means the explanation of the decision. It is required. Please write it in full sentences, so that another clinician can understand it even a year from now.",
    },
    {
      at: result({ ...checked, verdict: "decline" }),
      target: g("decision-acknowledge"),
      side: "left",
      title: "Confirm that you read everything",
      text: "If any check is FAIL or REVIEW, you must tick this box before you can save. Please tick it only after you have really read all of them.",
    },
    {
      at: result({ ...checked, verdict: "decline" }),
      target: g("decision-save"),
      side: "top",
      title: "A saved decision is final",
      text: "Nobody can change or delete a decision after it is saved. If a decision was wrong, check the pair again. This makes a new result. Record the correct decision there and explain the correction in the rationale.",
    },
  ],
}

const past: Tutorial = {
  id: "past",
  group: "results",
  name: "Find an older result",
  summary: "Search all saved results with the filters",
  keywords: "history search filter pending screening checked past",
  pages: ["/matches"],
  steps: [
    {
      at: matches,
      target: g("match-filters"),
      side: "bottom",
      title: "All saved results",
      text: "This page lists every result. With these filters you can show only one kind of result, only one kind of decision, or only results saved between two dates.",
    },
    {
      at: matches,
      target: filter("Source"),
      side: "bottom",
      title: "Where a result came from",
      text: "<b>Screening</b> means Concord made the result by itself during a match run. <b>Checked pair</b> means a person filled in the missing values and saved it.",
    },
    {
      at: matches,
      target: filter("Decision"),
      side: "bottom",
      title: "Results that wait for a decision",
      text: "Set this filter to <b>Pending</b> to see the checked pairs for which no decision has been recorded yet.",
    },
    {
      at: matches,
      target: g("match-out-of-date"),
      side: "bottom",
      optional: true,
      title: "Out of date",
      text: "This label means that the patient, the donor or the limits changed after the result was saved. The result itself stays as it was.",
    },
    {
      at: matches,
      target: g("match-row"),
      side: "bottom",
      optional: true,
      title: "Open a result",
      text: "Press PASS, REVIEW or FAIL to open the result. Press the name of the patient or the ID of the donor to open that record.",
    },
  ],
}

const outOfDate: Tutorial = {
  id: "ood",
  group: "results",
  name: "When a result is out of date",
  summary: "What it means and how to get a new result",
  keywords: "stale rerun refresh changed old",
  pages: ["/matches/$matchId"],
  steps: [
    {
      at: result(stale),
      target: g("result-out-of-date"),
      side: "bottom",
      title: "Out of date",
      text: "The patient's record, the donor's record or the limits changed after this result was saved. The result may be different today.",
    },
    {
      at: result(stale),
      target: g("result-frozen"),
      side: "bottom",
      title: "The old result is kept",
      text: "Concord does not change or delete the old result. It shows what was known on that day. This is important if a decision was made with it.",
    },
    {
      at: result(stale),
      target: g("result-check-again"),
      side: "bottom",
      title: "Check the pair again",
      text: "Press this link to open Check a pair. The same patient and donor are already chosen. Fill in the values and save, and you will have a new result.",
    },
    {
      at: { to: "/practice/patient", search: { menu: true } },
      target: g("record-rerun"),
      side: "left",
      title: "Make all screening results new",
      text: "If you changed a record and want new screening results for every pair, open the record. Press the three dots and choose <b>Rerun matching</b>.",
    },
  ],
}

export const resultTutorials = [read, checkPair, decide, past, outOfDate]
