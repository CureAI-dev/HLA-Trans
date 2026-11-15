CREATE TABLE "audit_log" (
	"seq" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_log_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"id" text NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"subject_id" text NOT NULL,
	"summary" text NOT NULL,
	CONSTRAINT "audit_log_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "criteria_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"version" integer NOT NULL,
	"author" text NOT NULL,
	"change_note" text NOT NULL,
	"criteria" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "criteria_versions_version_unique" UNIQUE("version")
);
--> statement-breakpoint
CREATE TABLE "decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"match_id" text NOT NULL,
	"verdict" text NOT NULL,
	"clinician" text NOT NULL,
	"rationale" text NOT NULL,
	"reasons" jsonb NOT NULL,
	"acknowledged_findings" boolean NOT NULL,
	"decided_at" timestamp with time zone NOT NULL,
	CONSTRAINT "decisions_match_id_unique" UNIQUE("match_id")
);
--> statement-breakpoint
CREATE TABLE "donors" (
	"id" text PRIMARY KEY NOT NULL,
	"version" integer NOT NULL,
	"donor_code" text NOT NULL,
	"state" text NOT NULL,
	"abo" text,
	"donation_type" text NOT NULL,
	"age_years" integer,
	"hospital" text NOT NULL,
	"content_hash" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "match_results" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text,
	"source" text NOT NULL,
	"patient_id" text NOT NULL,
	"donor_id" text NOT NULL,
	"patient_name" text NOT NULL,
	"donor_code" text NOT NULL,
	"patient_snapshot" text NOT NULL,
	"donor_snapshot" text NOT NULL,
	"criteria_version_id" text NOT NULL,
	"engine_version" text NOT NULL,
	"pair" jsonb NOT NULL,
	"result" jsonb NOT NULL,
	"overall" text NOT NULL,
	"blocker_count" integer NOT NULL,
	"missing_count" integer NOT NULL,
	"screen_key" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "match_results_source" CHECK ("match_results"."source" in ('screening','checked')),
	CONSTRAINT "match_results_overall" CHECK ("match_results"."overall" in ('pass','review','fail')),
	CONSTRAINT "match_results_run_source" CHECK (("match_results"."source" = 'screening') = ("match_results"."run_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "match_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"trigger" text NOT NULL,
	"subject_kind" text NOT NULL,
	"subject_id" text NOT NULL,
	"subject_label" text NOT NULL,
	"criteria_version_id" text NOT NULL,
	"status" text NOT NULL,
	"total" integer,
	"processed" integer DEFAULT 0 NOT NULL,
	"pass_count" integer DEFAULT 0 NOT NULL,
	"review_count" integer DEFAULT 0 NOT NULL,
	"fail_count" integer DEFAULT 0 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error" text,
	"cancel_requested" boolean DEFAULT false NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"started_at" timestamp with time zone,
	"heartbeat_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	CONSTRAINT "match_runs_status" CHECK ("match_runs"."status" in ('queued','running','succeeded','failed','cancelled')),
	CONSTRAINT "match_runs_subject_kind" CHECK ("match_runs"."subject_kind" in ('patient','donor'))
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" text PRIMARY KEY NOT NULL,
	"version" integer NOT NULL,
	"mrn" text NOT NULL,
	"full_name" text NOT NULL,
	"sort_name" text NOT NULL,
	"date_of_birth" text NOT NULL,
	"listing_state" text NOT NULL,
	"listing_date" text NOT NULL,
	"urgency_status" text,
	"abo" text,
	"device" text,
	"cpra" real,
	"content_hash" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "record_snapshots" (
	"hash" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"data" jsonb NOT NULL,
	CONSTRAINT "record_snapshots_kind" CHECK ("record_snapshots"."kind" in ('patient','donor'))
);
--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_match_id_match_results_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."match_results"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_run_id_match_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."match_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_donor_id_donors_id_fk" FOREIGN KEY ("donor_id") REFERENCES "public"."donors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_patient_snapshot_record_snapshots_hash_fk" FOREIGN KEY ("patient_snapshot") REFERENCES "public"."record_snapshots"("hash") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_donor_snapshot_record_snapshots_hash_fk" FOREIGN KEY ("donor_snapshot") REFERENCES "public"."record_snapshots"("hash") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_criteria_version_id_criteria_versions_id_fk" FOREIGN KEY ("criteria_version_id") REFERENCES "public"."criteria_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_runs" ADD CONSTRAINT "match_runs_criteria_version_id_criteria_versions_id_fk" FOREIGN KEY ("criteria_version_id") REFERENCES "public"."criteria_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_at_id_idx" ON "audit_log" USING btree ("at" DESC NULLS FIRST,"id" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "donors_state_idx" ON "donors" USING btree ("state") WHERE "donors"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "donors_updated_idx" ON "donors" USING btree ("updated_at" DESC NULLS FIRST,"id" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "donors_code_idx" ON "donors" USING btree ("donor_code","id");--> statement-breakpoint
CREATE UNIQUE INDEX "match_results_run_pair_uq" ON "match_results" USING btree ("run_id","patient_id","donor_id") WHERE "match_results"."run_id" is not null;--> statement-breakpoint
CREATE INDEX "match_results_created_idx" ON "match_results" USING btree ("created_at" DESC NULLS FIRST,"id" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "match_results_donor_idx" ON "match_results" USING btree ("donor_id","created_at" DESC NULLS FIRST,"id" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "match_results_patient_idx" ON "match_results" USING btree ("patient_id","created_at" DESC NULLS FIRST,"id" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "match_results_run_idx" ON "match_results" USING btree ("run_id","overall");--> statement-breakpoint
CREATE INDEX "match_runs_active_idx" ON "match_runs" USING btree ("status","created_at") WHERE "match_runs"."status" in ('queued','running');--> statement-breakpoint
CREATE INDEX "match_runs_created_idx" ON "match_runs" USING btree ("created_at" DESC NULLS FIRST,"id" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "match_runs_subject_idx" ON "match_runs" USING btree ("subject_id","created_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "patients_state_idx" ON "patients" USING btree ("listing_state") WHERE "patients"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "patients_updated_idx" ON "patients" USING btree ("updated_at" DESC NULLS FIRST,"id" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "patients_name_idx" ON "patients" USING btree ("sort_name","id");--> statement-breakpoint
CREATE INDEX "patients_listed_idx" ON "patients" USING btree ("listing_date" DESC NULLS FIRST,"id" DESC NULLS FIRST);