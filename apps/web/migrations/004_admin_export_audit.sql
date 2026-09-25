-- MTM migration 004 admin export audit (append-only). Requires 003.
-- Environments: every subscription database (loopback test, preview and
-- production) — applied ONLY by `node scripts/migrate.mjs`, which runs it in
-- one transaction and records its checksum in mtm_schema_migrations. Never
-- apply it to the legacy backend/ service (which has no database).
-- The guard below refuses direct psql execution, which would not be atomic.
-- Repeatable. Stores export metadata only — never exported content.
DO $guard$ BEGIN
  IF current_setting('mtm.migration_runner', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'MTM migrations must be applied with scripts/migrate.mjs';
  END IF;
END $guard$;

-- One row per authorized Founder Console export attempt. Written before the
-- file is released; if the write fails the export is refused.
CREATE TABLE IF NOT EXISTS mtm_admin_export_audit (
  id bigserial PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_account_id uuid NOT NULL REFERENCES mtm_accounts(id),
  actor_role text NOT NULL CHECK (actor_role IN ('founder','admin')),
  report text NOT NULL CHECK (report ~ '^[a-z_]{1,40}$'),
  sensitivity text NOT NULL CHECK (sensitivity IN ('aggregate','sensitive')),
  filters jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(filters) = 'object'),
  min_group integer NOT NULL CHECK (min_group >= 10),
  row_count integer CHECK (row_count >= 0),
  byte_count integer CHECK (byte_count >= 0),
  content_sha256 text CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  outcome text NOT NULL CHECK (outcome IN ('released','unavailable','rate_limited','step_up_required')),
  request_id text CHECK (request_id ~ '^[0-9a-f-]{36}$')
);
CREATE INDEX IF NOT EXISTS mtm_export_audit_actor ON mtm_admin_export_audit(actor_account_id, occurred_at);

-- Append-only: rows can be inserted, never changed or removed, by anyone
-- (including the table owner) while the trigger exists.
CREATE OR REPLACE FUNCTION mtm_export_audit_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'mtm_admin_export_audit is append-only';
END $$;
DROP TRIGGER IF EXISTS mtm_export_audit_no_change ON mtm_admin_export_audit;
CREATE TRIGGER mtm_export_audit_no_change
  BEFORE UPDATE OR DELETE ON mtm_admin_export_audit
  FOR EACH ROW EXECUTE FUNCTION mtm_export_audit_append_only();
DROP TRIGGER IF EXISTS mtm_export_audit_no_truncate ON mtm_admin_export_audit;
CREATE TRIGGER mtm_export_audit_no_truncate
  BEFORE TRUNCATE ON mtm_admin_export_audit
  FOR EACH STATEMENT EXECUTE FUNCTION mtm_export_audit_append_only();
REVOKE UPDATE, DELETE, TRUNCATE ON mtm_admin_export_audit FROM PUBLIC;
