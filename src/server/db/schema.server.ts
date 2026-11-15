import { sql } from "drizzle-orm"
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import type {
  Criteria,
  Decision,
  Donor,
  EvaluationResult,
  PairInputs,
  Patient,
} from "@/domain/schema"

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" })

export const patients = pgTable(
  "patients",
  {
    id: text("id").primaryKey(),
    version: integer("version").notNull(),
    mrn: text("mrn").notNull(),
    fullName: text("full_name").notNull(),
    sortName: text("sort_name").notNull(),
    dateOfBirth: text("date_of_birth").notNull(),
    listingState: text("listing_state").notNull(),
    listingDate: text("listing_date").notNull(),
    urgencyStatus: text("urgency_status"),
    abo: text("abo"),
    device: text("device"),
    cpra: real("cpra"),
    /** snapshotHash(data). A result is out of date when its snapshot hash differs. */
    contentHash: text("content_hash").notNull(),
    data: jsonb("data").$type<Patient>().notNull(),
    createdAt: ts("created_at").notNull(),
    updatedAt: ts("updated_at").notNull(),
    deletedAt: ts("deleted_at"),
  },
  (t) => [
    index("patients_state_idx").on(t.listingState).where(sql`${t.deletedAt} is null`),
    index("patients_updated_idx").on(t.updatedAt.desc().nullsFirst(), t.id.desc().nullsFirst()),
    index("patients_name_idx").on(t.sortName, t.id),
    index("patients_listed_idx").on(t.listingDate.desc().nullsFirst(), t.id.desc().nullsFirst()),
  ]
)

export const donors = pgTable(
  "donors",
  {
    id: text("id").primaryKey(),
    version: integer("version").notNull(),
    donorCode: text("donor_code").notNull(),
    state: text("state").notNull(),
    abo: text("abo"),
    donationType: text("donation_type").notNull(),
    ageYears: integer("age_years"),
    hospital: text("hospital").notNull(),
    contentHash: text("content_hash").notNull(),
    data: jsonb("data").$type<Donor>().notNull(),
    createdAt: ts("created_at").notNull(),
    updatedAt: ts("updated_at").notNull(),
    deletedAt: ts("deleted_at"),
  },
  (t) => [
    index("donors_state_idx").on(t.state).where(sql`${t.deletedAt} is null`),
    index("donors_updated_idx").on(t.updatedAt.desc().nullsFirst(), t.id.desc().nullsFirst()),
    index("donors_code_idx").on(t.donorCode, t.id),
  ]
)

export const recordSnapshots = pgTable(
  "record_snapshots",
  {
    hash: text("hash").primaryKey(),
    kind: text("kind").notNull(),
    data: jsonb("data").$type<Patient | Donor>().notNull(),
  },
  (t) => [check("record_snapshots_kind", sql`${t.kind} in ('patient','donor')`)]
)

export const criteriaVersions = pgTable("criteria_versions", {
  id: text("id").primaryKey(),
  version: integer("version").notNull().unique(),
  author: text("author").notNull(),
  changeNote: text("change_note").notNull(),
  criteria: jsonb("criteria").$type<Criteria>().notNull(),
  createdAt: ts("created_at").notNull(),
})

export const RUN_STATUSES = ["queued", "running", "succeeded", "failed", "cancelled"] as const
export const RUN_TRIGGERS = ["donor.created", "patient.created", "manual", "seed"] as const

export const matchRuns = pgTable(
  "match_runs",
  {
    id: text("id").primaryKey(),
    trigger: text("trigger").$type<(typeof RUN_TRIGGERS)[number]>().notNull(),
    subjectKind: text("subject_kind").$type<"patient" | "donor">().notNull(),
    subjectId: text("subject_id").notNull(),
    subjectLabel: text("subject_label").notNull(),
    criteriaVersionId: text("criteria_version_id")
      .notNull()
      .references(() => criteriaVersions.id),
    status: text("status").$type<(typeof RUN_STATUSES)[number]>().notNull(),
    total: integer("total"),
    processed: integer("processed").notNull().default(0),
    passCount: integer("pass_count").notNull().default(0),
    reviewCount: integer("review_count").notNull().default(0),
    failCount: integer("fail_count").notNull().default(0),
    attempts: integer("attempts").notNull().default(0),
    error: text("error"),
    cancelRequested: boolean("cancel_requested").notNull().default(false),
    createdBy: text("created_by").notNull(),
    createdAt: ts("created_at").notNull(),
    startedAt: ts("started_at"),
    heartbeatAt: ts("heartbeat_at"),
    finishedAt: ts("finished_at"),
  },
  (t) => [
    check("match_runs_status", sql`${t.status} in ('queued','running','succeeded','failed','cancelled')`),
    check("match_runs_subject_kind", sql`${t.subjectKind} in ('patient','donor')`),
    index("match_runs_active_idx")
      .on(t.status, t.createdAt)
      .where(sql`${t.status} in ('queued','running')`),
    index("match_runs_created_idx").on(t.createdAt.desc().nullsFirst(), t.id.desc().nullsFirst()),
    index("match_runs_subject_idx").on(t.subjectId, t.createdAt.desc().nullsFirst()),
  ]
)

export const matchResults = pgTable(
  "match_results",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").references(() => matchRuns.id),
    source: text("source").$type<"screening" | "checked">().notNull(),
    patientId: text("patient_id").notNull().references(() => patients.id),
    donorId: text("donor_id").notNull().references(() => donors.id),
    patientName: text("patient_name").notNull(),
    donorCode: text("donor_code").notNull(),
    patientSnapshot: text("patient_snapshot").notNull().references(() => recordSnapshots.hash),
    donorSnapshot: text("donor_snapshot").notNull().references(() => recordSnapshots.hash),
    criteriaVersionId: text("criteria_version_id").notNull().references(() => criteriaVersions.id),
    engineVersion: text("engine_version").notNull(),
    pair: jsonb("pair").$type<PairInputs>().notNull(),
    result: jsonb("result").$type<EvaluationResult>().notNull(),
    overall: text("overall").$type<"pass" | "review" | "fail">().notNull(),
    blockerCount: integer("blocker_count").notNull(),
    missingCount: integer("missing_count").notNull(),
    /** Fixed-width key from screenKey(); ORDER BY screen_key COLLATE "C". Null for patient runs and checked pairs. */
    screenKey: text("screen_key"),
    createdBy: text("created_by").notNull(),
    createdAt: ts("created_at").notNull(),
  },
  (t) => [
    check("match_results_source", sql`${t.source} in ('screening','checked')`),
    check("match_results_overall", sql`${t.overall} in ('pass','review','fail')`),
    check(
      "match_results_run_source",
      sql`(${t.source} = 'screening') = (${t.runId} is not null)`
    ),
    uniqueIndex("match_results_run_pair_uq")
      .on(t.runId, t.patientId, t.donorId)
      .where(sql`${t.runId} is not null`),
    index("match_results_created_idx").on(t.createdAt.desc().nullsFirst(), t.id.desc().nullsFirst()),
    index("match_results_donor_idx").on(t.donorId, t.createdAt.desc().nullsFirst(), t.id.desc().nullsFirst()),
    index("match_results_patient_idx").on(t.patientId, t.createdAt.desc().nullsFirst(), t.id.desc().nullsFirst()),
    index("match_results_run_idx").on(t.runId, t.overall),
  ]
)

export const decisions = pgTable("decisions", {
  id: text("id").primaryKey(),
  matchId: text("match_id")
    .notNull()
    .unique()
    .references(() => matchResults.id),
  verdict: text("verdict").$type<Decision["verdict"]>().notNull(),
  clinician: text("clinician").notNull(),
  rationale: text("rationale").notNull(),
  reasons: jsonb("reasons").$type<Decision["reasons"]>().notNull(),
  acknowledgedFindings: boolean("acknowledged_findings").notNull(),
  decidedAt: ts("decided_at").notNull(),
})

export const auditLog = pgTable(
  "audit_log",
  {
    seq: bigint("seq", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    id: text("id").notNull().unique(),
    at: ts("at").notNull(),
    actor: text("actor").notNull(),
    action: text("action").notNull(),
    subjectId: text("subject_id").notNull(),
    summary: text("summary").notNull(),
  },
  (t) => [index("audit_at_id_idx").on(t.at.desc().nullsFirst(), t.id.desc().nullsFirst())]
)
