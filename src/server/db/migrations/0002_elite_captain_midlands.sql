DROP INDEX "match_runs_active_idx";--> statement-breakpoint
CREATE INDEX "match_runs_status_created_idx" ON "match_runs" USING btree ("status","created_at" DESC NULLS FIRST,"id" DESC NULLS FIRST);