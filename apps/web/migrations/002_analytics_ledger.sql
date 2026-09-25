-- Apply only to a dedicated TEST database. Never to the live legacy service.
-- Requires 001_subscriptions.sql. Transactional and repeatable: re-running it
-- never duplicates the baseline or moves a recorded coverage start.
BEGIN;

-- When each derived dataset began recording. Periods before a start are not
-- presented as complete business performance unless a validated backfill
-- (method='backfill') is recorded.
CREATE TABLE IF NOT EXISTS mtm_analytics_coverage (
  dataset text PRIMARY KEY CHECK (dataset IN ('payment_ledger','subscription_contracts','subscription_history')),
  coverage_start timestamptz NOT NULL,
  method text NOT NULL CHECK (method IN ('webhook','backfill')),
  note text NOT NULL DEFAULT ''
);

-- Money movements, one row per provider object. Amounts are integer minor
-- units in the provider currency; unlike currencies are never combined here.
CREATE TABLE IF NOT EXISTS mtm_ledger_entries (
  entry_key text PRIMARY KEY,
  provider text NOT NULL CHECK (provider = 'stripe'),
  kind text NOT NULL CHECK (kind IN ('payment','refund','dispute')),
  user_id uuid NOT NULL REFERENCES mtm_accounts(id),
  provider_customer_id text NOT NULL,
  provider_subscription_id text,
  provider_invoice_id text,
  provider_payment_intent_id text,
  provider_charge_id text,
  provider_object_id text NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  currency text NOT NULL CHECK (currency ~ '^[a-z]{3}$'),
  status text NOT NULL,
  plan text CHECK (plan IN ('monthly','annual')),
  price_id text,
  livemode boolean NOT NULL,
  provider_occurred_at timestamptz NOT NULL,
  occurred_at_source text NOT NULL CHECK (occurred_at_source IN ('paid_at','object_created','event_created')),
  source text NOT NULL CHECK (source IN ('webhook','backfill')),
  source_event_id text,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mtm_ledger_occurred ON mtm_ledger_entries(kind, provider_occurred_at);
CREATE INDEX IF NOT EXISTS mtm_ledger_invoice ON mtm_ledger_entries(provider_invoice_id);
CREATE INDEX IF NOT EXISTS mtm_ledger_intent ON mtm_ledger_entries(provider_payment_intent_id);

-- Provider objects that could not be recorded completely. Never guessed.
CREATE TABLE IF NOT EXISTS mtm_ledger_gaps (
  gap_key text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES mtm_accounts(id),
  kind text NOT NULL,
  provider_object_id text NOT NULL,
  reason text NOT NULL,
  source_event_id text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

-- Current contract snapshot, refreshed from the provider on each sync.
ALTER TABLE mtm_subscriptions
  ADD COLUMN IF NOT EXISTS price_id text,
  ADD COLUMN IF NOT EXISTS unit_amount_minor bigint CHECK (unit_amount_minor >= 0),
  ADD COLUMN IF NOT EXISTS currency text CHECK (currency ~ '^[a-z]{3}$'),
  ADD COLUMN IF NOT EXISTS billing_interval text CHECK (billing_interval IN ('month','year')),
  ADD COLUMN IF NOT EXISTS interval_count integer CHECK (interval_count > 0),
  ADD COLUMN IF NOT EXISTS quantity integer CHECK (quantity > 0),
  ADD COLUMN IF NOT EXISTS discounted boolean,
  ADD COLUMN IF NOT EXISTS contract_recorded_at timestamptz;

-- Append-only subscription state transitions. One row per changed state.
CREATE TABLE IF NOT EXISTS mtm_subscription_history (
  id bigserial PRIMARY KEY,
  subscription_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES mtm_accounts(id),
  source text NOT NULL CHECK (source IN ('baseline','webhook')),
  source_event_id text,
  provider_event_created_at timestamptz,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  transitions text[] NOT NULL,
  prev_status text,
  status text NOT NULL,
  prev_plan text,
  plan text NOT NULL,
  prev_cancel_at_period_end boolean,
  cancel_at_period_end boolean NOT NULL,
  prev_paid_until timestamptz,
  paid_until timestamptz,
  UNIQUE (subscription_id, source_event_id)
);
CREATE INDEX IF NOT EXISTS mtm_history_subscription ON mtm_subscription_history(subscription_id, recorded_at);
CREATE INDEX IF NOT EXISTS mtm_history_recorded ON mtm_subscription_history(recorded_at);

-- Baseline: the state already projected at the moment history starts.
-- Guarded so re-running the migration never re-baselines.
INSERT INTO mtm_subscription_history(subscription_id,user_id,source,transitions,status,plan,cancel_at_period_end,paid_until)
SELECT stripe_id,user_id,'baseline',ARRAY['baseline'],status,plan,cancel_at_period_end,paid_until
FROM mtm_subscriptions
WHERE NOT EXISTS (SELECT 1 FROM mtm_analytics_coverage WHERE dataset='subscription_history');

INSERT INTO mtm_analytics_coverage(dataset,coverage_start,method,note) VALUES
  ('payment_ledger',now(),'webhook','Invoice payments, refunds and disputes recorded from signed webhooks from this instant. No backfill.'),
  ('subscription_contracts',now(),'webhook','Contract amounts captured on each subscription sync from this instant. Earlier rows gain one on their next webhook.'),
  ('subscription_history',now(),'webhook','Baseline of projected states at this instant, then webhook transitions.')
ON CONFLICT (dataset) DO NOTHING;
COMMIT;
