CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS patients_search_trgm ON patients USING gin (full_name gin_trgm_ops, mrn gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS donors_search_trgm ON donors USING gin (donor_code gin_trgm_ops, hospital gin_trgm_ops);
--> statement-breakpoint
-- Run detail pages order by screening key with byte (C) collation; see src/domain/screen-key.ts.
CREATE INDEX IF NOT EXISTS match_results_run_screen_idx ON match_results (run_id, screen_key COLLATE "C", id) WHERE run_id IS NOT NULL;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION hla_reject_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Table % is append-only (% rejected)', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'P0001', HINT = 'immutable';
END $$;
--> statement-breakpoint
CREATE TRIGGER audit_log_immutable BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION hla_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER match_results_immutable BEFORE UPDATE OR DELETE ON match_results
  FOR EACH ROW EXECUTE FUNCTION hla_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER criteria_versions_immutable BEFORE UPDATE OR DELETE ON criteria_versions
  FOR EACH ROW EXECUTE FUNCTION hla_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER record_snapshots_immutable BEFORE UPDATE OR DELETE ON record_snapshots
  FOR EACH ROW EXECUTE FUNCTION hla_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER decisions_immutable BEFORE UPDATE OR DELETE ON decisions
  FOR EACH ROW EXECUTE FUNCTION hla_reject_mutation();
