-- MTM migration 003 analytics intelligence (billing reason, failures, listening schema). Requires 002.
-- Environments: every subscription database (loopback test, preview and
-- production) — applied ONLY by `node scripts/migrate.mjs`, which runs it in
-- one transaction and records its checksum in mtm_schema_migrations. Never
-- apply it to the legacy backend/ service (which has no database).
-- The guard below refuses direct psql execution, which would not be atomic.
-- Repeatable. Adds no production instrumentation: the listening table is created empty and nothing writes
-- to it until telemetry is separately approved and wired in.
DO $guard$ BEGIN
  IF current_setting('mtm.migration_runner', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'MTM migrations must be applied with scripts/migrate.mjs';
  END IF;
END $guard$;

-- Coverage datasets gain the Phase 4 sources. 'listening' is deliberately
-- NOT inserted: its coverage starts only when approved telemetry goes live.
ALTER TABLE mtm_analytics_coverage DROP CONSTRAINT IF EXISTS mtm_analytics_coverage_dataset_check;
ALTER TABLE mtm_analytics_coverage ADD CONSTRAINT mtm_analytics_coverage_dataset_check CHECK (dataset IN (
  'payment_ledger','subscription_contracts','subscription_history',
  'billing_reason','payment_failures','listening'));

-- New vs renewal classification from Stripe's invoice billing_reason, captured
-- forward only. Earlier ledger rows stay NULL ("unclassified"), never guessed.
ALTER TABLE mtm_ledger_entries ADD COLUMN IF NOT EXISTS billing_reason text;

-- Failed invoice value: one row per invoice that has had a failed payment
-- attempt. Recovery is derived at read time from a later ledger payment.
CREATE TABLE IF NOT EXISTS mtm_payment_failures (
  provider_invoice_id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES mtm_accounts(id),
  provider_subscription_id text,
  amount_due_minor bigint NOT NULL CHECK (amount_due_minor >= 0),
  currency text NOT NULL CHECK (currency ~ '^[a-z]{3}$'),
  livemode boolean NOT NULL,
  first_failed_at timestamptz NOT NULL,
  last_failed_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 1 CHECK (attempts > 0),
  source_event_id text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mtm_failures_first ON mtm_payment_failures(first_failed_at);

-- Content hierarchy for future content analytics. Populated by the catalogue
-- import; never inferred from titles.
ALTER TABLE mtm_library
  ADD COLUMN IF NOT EXISTS story_world text,
  ADD COLUMN IF NOT EXISTS season text;

-- Privacy-minimised listening telemetry (schema only; see ADMIN_ANALYTICS_V4.md).
-- No IP address, user agent, precise location, email or free text is stored.
-- listener_id is the internal account UUID (NULL when anonymous) and is never
-- returned by any analytics query. Classification is derived server-side.
CREATE TABLE IF NOT EXISTS mtm_listening_events (
  id bigserial PRIMARY KEY,
  session_id uuid NOT NULL,
  client_event_seq integer NOT NULL CHECK (client_event_seq >= 0),
  event_type text NOT NULL CHECK (event_type IN (
    'story_started','progress','story_completed','sleep_timer_set','sleep_timer_ended')),
  story_id text NOT NULL CHECK (story_id ~ '^[a-zA-Z0-9_-]{1,128}$'),
  listener_id uuid REFERENCES mtm_accounts(id),
  listener_class text NOT NULL CHECK (listener_class IN ('paid','trial','anonymous','unknown')),
  device_class text NOT NULL DEFAULT 'unknown' CHECK (device_class IN ('phone','tablet','desktop','speaker','unknown')),
  position_seconds integer CHECK (position_seconds >= 0),
  listened_seconds integer NOT NULL DEFAULT 0 CHECK (listened_seconds BETWEEN 0 AND 3600),
  story_duration_seconds integer CHECK (story_duration_seconds > 0),
  occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, client_event_seq)
);
CREATE INDEX IF NOT EXISTS mtm_listening_occurred ON mtm_listening_events(occurred_at);
CREATE INDEX IF NOT EXISTS mtm_listening_story ON mtm_listening_events(story_id, occurred_at);

-- Indexes justified by the Phase 3/4 bounded period aggregates.
CREATE INDEX IF NOT EXISTS mtm_billing_type_created ON mtm_billing_events(type, created_at);
CREATE INDEX IF NOT EXISTS mtm_billing_user_type ON mtm_billing_events(user_id, type, created_at);
CREATE INDEX IF NOT EXISTS mtm_accounts_created ON mtm_accounts(created_at);
CREATE INDEX IF NOT EXISTS mtm_accounts_trial_start ON mtm_accounts(trial_start) WHERE trial_start IS NOT NULL;
CREATE INDEX IF NOT EXISTS mtm_webhook_processed ON mtm_webhook_events(processed_at);

INSERT INTO mtm_analytics_coverage(dataset,coverage_start,method,note) VALUES
  ('billing_reason',now(),'webhook','New vs renewal classification recorded on ledger payments from this instant. Earlier payments are unclassified.'),
  ('payment_failures',now(),'webhook','Failed invoice amounts recorded from this instant. Earlier failures have counts only.')
ON CONFLICT (dataset) DO NOTHING;
