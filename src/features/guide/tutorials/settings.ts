import { g } from "../guide.types"
import type { Tutorial } from "../guide.types"

const criteriaPage = { to: "/criteria" }
const audit = { to: "/audit", search: {} }
const dataPage = { to: "/data" }

const criteria: Tutorial = {
  id: "criteria",
  group: "settings",
  name: "Change the criteria",
  summary: "The limits that the checks use",
  keywords: "limits thresholds version publish mfi settings rules",
  pages: ["/criteria"],
  steps: [
    {
      at: criteriaPage,
      target: g("criteria-note"),
      side: "bottom",
      title: "What criteria are",
      text: "Criteria are the limits that Concord uses in its checks. For example, how many minutes without blood flow are still a PASS. Only the person chosen by your program should change them, because they affect every new result.",
    },
    {
      at: criteriaPage,
      target: g("criteria-tabs"),
      side: "bottom",
      title: "One tab for each check",
      text: "The limits are in six tabs, one for each of the six checks.",
      try: {
        text: "Press <b>HLA and antibodies</b>.",
        nudge: "Please press HLA and antibodies.",
        press: g("criteria-tab-immunology"),
      },
    },
    {
      at: criteriaPage,
      target: g("criteria-fields"),
      side: "top",
      title: "Where a limit comes from",
      text: "Under each limit you see its source. It can be a policy, a study or a choice of your hospital. If two limits do not fit together, Concord tells you and does not accept them.",
    },
    {
      at: criteriaPage,
      target: g("criteria-change-note"),
      side: "top",
      title: "Explain the change",
      text: "You must write a change note. Please write what you changed and why. The note is kept together with the new limits.",
    },
    {
      at: criteriaPage,
      target: g("criteria-publish"),
      side: "top",
      align: "start",
      title: "Look at the changes again",
      text: "When you press <b>Review and publish</b>, Concord first shows the old values and the new values next to each other. Nothing changes until you confirm. You can still cancel.",
    },
    {
      at: criteriaPage,
      target: g("criteria-history"),
      side: "top",
      title: "Earlier versions are kept",
      text: "Each time you publish, Concord makes a new version. New checks use the new version. Results that were saved earlier keep their old version and are marked <b>Out of date</b>.",
    },
  ],
}

const auditLog: Tutorial = {
  id: "audit",
  group: "settings",
  name: "Read the audit log",
  summary: "See who did what and when",
  keywords: "history who when trace",
  pages: ["/audit"],
  steps: [
    {
      at: audit,
      target: g("audit-list"),
      side: "top",
      title: "What the audit log is",
      text: "It is the list of everything people did in Concord, such as adding a record or recording a decision. The newest entry is at the top. Nobody can change or delete a single entry.",
    },
    {
      at: audit,
      target: '[role="search"] [aria-label="Action"]',
      side: "bottom",
      title: "Show one kind of entry",
      text: "Choose one action here, for example <b>Decision recorded</b>, to see only those entries.",
    },
    {
      at: audit,
      target: g("audit-row"),
      side: "bottom",
      optional: true,
      title: "How to read an entry",
      text: "Each row shows the time, the person, the action and a short summary. The time is shown in the time of your own place.",
    },
  ],
}

const data: Tutorial = {
  id: "data",
  group: "settings",
  name: "Work with data",
  summary: "Download, bring in, practice records and reset",
  keywords: "backup export import demo reset json",
  pages: ["/data"],
  steps: [
    {
      at: dataPage,
      target: g("data-export"),
      side: "right",
      title: "Export: download a copy",
      text: "This downloads the patients, the donors, the history of the criteria and a list of the results in one file. Please keep the file in a safe place. It does not contain everything, so it is not a full backup of the database.",
    },
    {
      at: dataPage,
      target: g("data-import"),
      side: "left",
      title: "Import: bring in old records",
      text: "This is for a backup file from the earlier version of Concord. Concord first shows you what is in the file and asks before it adds anything. Records that already exist are not changed.",
    },
    {
      at: dataPage,
      target: g("data-demo"),
      side: "right",
      title: "Load practice records",
      text: "This adds made-up patients and donors, and Concord starts to compare them. If you press it twice, no record is added twice.",
    },
    {
      at: dataPage,
      target: g("data-reset"),
      side: "left",
      title: "Reset: please be very careful",
      text: "Reset deletes all patients, donors, results and decisions for <b>everyone</b> who uses this database. It cannot be undone in Concord. You must type RESET before the button works. Please ask your administrator to make a backup first.",
    },
  ],
}

export const settingsTutorials = [criteria, auditLog, data]
