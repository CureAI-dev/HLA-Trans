import { g } from "../guide.types"
import type { Tutorial } from "../guide.types"
import { exists, search, textOf, type, value } from "./dom"

const newPatient = { to: "/patients/new", search: { practice: true } }
const newDonor = { to: "/donors/new", search: { practice: true } }
const patients = (s: Record<string, unknown> = {}) => ({
  to: "/patients",
  search: s,
})
const record = (s: Record<string, unknown> = {}) => ({
  to: "/practice/patient",
  search: s,
})
/** Positioned wrapper of an open select list. */
const OPEN_LIST = ":has(> [data-slot='select-content'])"

const patient: Tutorial = {
  id: "patient",
  group: "records",
  name: "Add a patient",
  summary: "Fill in the patient form correctly and save it",
  keywords: "candidate new hla sensitization cpra acceptance form antibodies",
  pages: ["/patients/new", "/patients"],
  steps: [
    {
      at: newPatient,
      target: g("form-sections"),
      side: "right",
      title: "The list of sections",
      text: "The patient form is long, so it is divided into sections. A tick means every value in that section is filled in. A dotted circle means something is still empty. Press the name of a section to go to it.",
    },
    {
      at: newPatient,
      target: "#identity",
      side: "right",
      title: "Five boxes you must fill in",
      text: "Boxes with a star (*) are required: the medical record number, first name, last name, date of birth and sex. You cannot save the patient without them. Everything else can be added later.",
    },
    {
      at: newPatient,
      target: "#listing",
      side: "right",
      title: "The state of the patient",
      text: "When a donor is added, Concord only looks at patients whose state is <b>Active on waitlist</b>. With any other state, the patient is left out, or the result shows a reason why the patient cannot be considered now. That reason is called a blocker.",
    },
    {
      at: newPatient,
      target: "#body",
      side: "bottom",
      title: "Leave a box empty if you do not know",
      text: 'Please never type 0 when you mean "I do not know". Concord reads 0 as a real measurement, and the result would be wrong. An empty box means the value is not recorded yet.',
      try: {
        text: "Type any height and any weight. Concord will work out the BMI (body mass index).",
        done: "Well done. Concord worked out the BMI from the two values.",
        nudge: "Please type a height and a weight first.",
        check: () =>
          Number(value("#field-body\\.heightCm")) > 0 &&
          Number(value("#field-body\\.weightKg")) > 0,
        fill: {
          "#field-body\\.heightCm": "170",
          "#field-body\\.weightKg": "70",
        },
      },
    },
    {
      at: newPatient,
      target: "#field-history\\.malignancyHistory",
      side: "top",
      title: "Unknown does not mean No",
      text: "Choose <b>No</b> only when you are sure the answer is no. If you do not know, choose <b>Unknown</b>. Concord then shows the answer as missing, so that someone can find out.",
    },
    {
      at: newPatient,
      target: g("antibody-paste"),
      side: "top",
      title: "Antibodies",
      text: "Antibodies are proteins in the patient's blood that may attack a new heart. <b>cPRA</b>, at the top of this section, is a percentage from your laboratory. It tells how many donors the antibodies would react against. Concord does not work it out, so type the value the laboratory gives you.",
      before: () => {
        if (!exists("[aria-label^='Remove antibody']"))
          type(`${g("antibody-paste")} input`, "A2 8000, B44 3500")
      },
      try: {
        text: "We put in two antibodies for you. The number after each name is its strength (MFI). Press <b>Import rows</b>.",
        done: "Two rows were added. If Concord cannot read something, it stays in the box so that you can correct it.",
        nudge: "Please press Import rows, next to the box.",
        check: () => exists("[aria-label^='Remove antibody']"),
      },
    },
    {
      at: newPatient,
      target: "#acceptance",
      side: "top",
      title: "Which donors the patient accepts",
      text: "These limits say which donors are acceptable for this one patient. If a donor is outside a limit, the result is FAIL, even if everything else passes. Please make sure the limits agree with what the patient has consented to.",
    },
    {
      at: newPatient,
      target: "#hla",
      side: "top",
      title: "HLA typing",
      text: "HLA is the patient's tissue type. Each row is one group and has two boxes. You can type a short form. If you type 2 in an A box, Concord changes it to A2. If there is only one value, leave the second box empty.",
    },
    {
      at: newPatient,
      target: g("form-actions"),
      side: "left",
      title: "Saving the patient",
      text: "When you press <b>Save patient</b>, Concord saves the record and starts comparing this patient with every available donor. This happens in the background, so you can keep working. A message tells you that it has started.",
    },
  ],
}

const donor: Tutorial = {
  id: "donor",
  group: "records",
  name: "Add a donor",
  summary: "Fill in the donor form correctly and save it",
  keywords: "dcd dbd infection phs vasoactive echo new form medicine",
  pages: ["/donors/new", "/donors"],
  steps: [
    {
      at: newDonor,
      target: "#identity",
      side: "bottom",
      title: "The donor ID and age",
      text: "Only the donor ID is required to save. The age is written in whole years. Unlike the patient form, there is no date of birth here.",
    },
    {
      at: newDonor,
      target: "#donation",
      side: "top",
      title: "How the donation happens",
      text: "There are two types. In <b>DBD</b> the donor has died because the brain stopped working. In <b>DCD</b> the donor has died because the heart stopped beating. For DCD you also need the recovery method and the warm ischemia time, which is the time the heart had too little blood flow. Concord checks both.",
    },
    {
      at: newDonor,
      target: g("phs-criteria"),
      side: "top",
      title: "Risk criteria",
      text: "These ten questions come from the United States Public Health Service (PHS). They ask about the 30 days before the organ was recovered. Tick each one that is true. They show a higher chance of a recent infection.",
    },
    {
      at: newDonor,
      target: g("vasoactives"),
      side: "top",
      title: "Medicines that support the heart",
      text: "Add one row for each medicine. The dose is in mcg/kg/min. Only vasopressin is different, and its dose is in units/hour. If you add a medicine without a dose, Concord shows the dose as missing.",
    },
    {
      at: newDonor,
      target: "#echo",
      side: "top",
      title: "How well the heart pumps",
      text: "<b>LVEF</b> is the share of blood the main pumping chamber pushes out with each beat. If the test was done again, type the second value too, because Concord uses the second one. Please fill in both wall thicknesses. If one is empty, Concord marks it as missing.",
    },
    {
      at: newDonor,
      target: g("serology"),
      side: "top",
      title: "Infection tests",
      text: "Every test starts as <b>Not done</b>. Please change each one to the result from the laboratory. Concord shows a required test that is not done as missing. It never reads it as negative.",
      try: {
        text: "Change the first test, <b>HIV antibody</b>, to Negative.",
        done: "Well done. The other tests still say Not done, so Concord will ask for them.",
        nudge: "Please change the first test to Negative.",
        check: () =>
          /negative/i.test(
            textOf(`${g("serology")} [data-slot="select-trigger"]`)
          ),
        allow: OPEN_LIST,
      },
    },
    {
      at: newDonor,
      target: g("form-actions"),
      side: "left",
      title: "Saving the donor",
      text: "When you press <b>Save donor</b>, Concord saves the record and starts comparing this heart with every patient who is active on the waitlist. You can keep working while this runs.",
    },
  ],
}

const findRecord: Tutorial = {
  id: "find",
  group: "records",
  name: "Find a patient or donor",
  summary: "Search the list and use the filters",
  keywords: "search filter sort list mrn record",
  pages: ["/patients", "/donors"],
  steps: [
    {
      at: patients(),
      target: g("list-search"),
      side: "bottom",
      title: "Search the list",
      text: "You can search by the patient's name or medical record number (MRN). The list changes only after you press Enter or the search button.",
      try: {
        text: "Type <b>Maya</b> and press Enter.",
        nudge: "Please type a name and then press Enter.",
        check: () => search("q") !== null,
        auto: true,
      },
    },
    {
      at: patients({ q: "Maya" }),
      target: g("list-filters"),
      side: "bottom",
      title: "Show only some patients",
      text: "These boxes are filters. You can show only one state, one blood type or one level of urgency. The last box changes the order of the list. You can use filters and the search at the same time.",
    },
    {
      at: patients({ q: "Maya" }),
      target: g("list-counts"),
      side: "bottom",
      title: "Count boxes",
      text: "Each box counts the patients in your current list. Some boxes also work as filters when you press them.",
      try: {
        text: "Press <b>High urgency</b>.",
        nudge: "Please press the High urgency box.",
        check: () => search("flag") === "urgent",
        auto: true,
      },
    },
    {
      at: patients({ q: "Maya", flag: "urgent" }),
      target: g("list-reset"),
      side: "bottom",
      title: "Show the full list again",
      text: "The Reset button removes your search and all the filters.",
      try: {
        text: "Press <b>Reset</b>.",
        nudge: "Please press Reset.",
        press: g("list-reset"),
      },
    },
    {
      at: patients(),
      target: g("list-table"),
      side: "top",
      title: "Open a patient",
      text: "Press a name to open the record of that patient. The Donors page works in the same way. There you search by donor ID or by hospital.",
    },
  ],
}

const readRecord: Tutorial = {
  id: "record",
  group: "records",
  name: "Read a patient or donor record",
  summary: "Warnings, missing values and the three tabs",
  keywords: "flags completeness overview risk",
  pages: ["/patients/$patientId", "/donors/$donorId"],
  steps: [
    {
      at: record(),
      target: g("page-badges"),
      side: "bottom",
      title: "The most important facts",
      text: "Under the name you see the state on the waiting list, how urgent the patient is, the blood type, the age and the sex.",
    },
    {
      at: record(),
      target: "[aria-labelledby='card-risk-flags']",
      side: "left",
      title: "Risk flags",
      text: "A risk flag is a fact that a clinician should look at. For example, this patient has a machine that supports the heart. A flag is only a reminder. It does not decide anything.",
    },
    {
      at: record(),
      target: "[aria-labelledby='card-data-completeness']",
      side: "left",
      title: "Data completeness",
      text: "This shows how much of the record is filled in. The empty values that matching needs are listed first. Press one to go to that place in the form.",
    },
    {
      at: record(),
      target: g("record-tabs"),
      side: "bottom",
      title: "Three tabs",
      text: "A record has three tabs. <b>Overview</b> is a short summary. <b>Clinical record</b> shows every value. <b>Matches</b> shows the results for this person.",
      try: {
        text: "Press <b>Clinical record</b>.",
        nudge: "Please press Clinical record.",
        press: g("tab-record"),
      },
    },
    {
      at: record({ tab: "record" }),
      target: g("record-values"),
      side: "top",
      title: "Not recorded and No are different",
      text: "<b>Not recorded</b> means nobody has filled in that value yet. <b>No</b> means someone answered the question and the answer was no.",
    },
    {
      at: record({ tab: "matches" }),
      target: g("record-matches"),
      side: "top",
      title: "The results for this person",
      text: "The Matches tab lists every result for this patient, with the newest first. On the record of a donor, this tab lists the patients that were compared with that donor.",
    },
  ],
}

const keepRecord: Tutorial = {
  id: "keep",
  group: "records",
  name: "Change or delete a record",
  summary: "Edit a record, match it again or delete it",
  keywords: "edit rerun delete conflict unsaved update",
  pages: ["/patients/$patientId", "/donors/$donorId"],
  steps: [
    {
      at: record(),
      target: g("record-edit"),
      side: "bottom",
      align: "end",
      title: "Edit the record",
      text: "Press this button when a value changes. If you try to leave without saving, Concord asks you first. If another person saved the same record while you were editing, Concord tells you to load the page again.",
    },
    {
      at: record(),
      target: "[aria-labelledby='card-latest-matching']",
      side: "left",
      title: "Editing does not start a new comparison",
      text: "After you edit a record, the older results stay as they were. Concord marks them <b>Out of date</b>, so you know that they used the old values.",
    },
    {
      at: record(),
      target: g("record-more"),
      side: "bottom",
      align: "end",
      title: "Open the menu",
      text: "To compare this patient again, first open the menu with the three dots.",
      try: {
        text: "Press the three dots.",
        nudge: "Please press the button with three dots.",
        press: g("record-more"),
      },
    },
    {
      at: record({ menu: true }),
      target: g("record-rerun"),
      side: "left",
      title: "Rerun matching",
      text: "Rerun means run again. Concord compares this patient with every available donor again and uses the new values. Please do this after every important change.",
    },
    {
      at: record({ menu: true }),
      target: g("record-delete"),
      side: "left",
      title: "Delete the record",
      text: "This removes the patient from the lists and from future comparisons. Results that were already saved stay, because each result keeps its own copy of the record. Concord asks you to confirm before it deletes.",
    },
  ],
}

export const recordTutorials = [
  patient,
  donor,
  findRecord,
  readRecord,
  keepRecord,
]
