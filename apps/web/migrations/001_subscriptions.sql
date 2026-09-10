-- Apply only to a dedicated TEST database. Never to the live legacy service.
BEGIN;
CREATE TABLE IF NOT EXISTS mtm_accounts (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  registration jsonb NOT NULL,
  customer_id text UNIQUE,
  trial_days integer NOT NULL CHECK (trial_days BETWEEN 0 AND 30),
  trial_status text NOT NULL DEFAULT 'offered',
  trial_start timestamptz,
  trial_end timestamptz,
  card_required boolean NOT NULL DEFAULT false,
  auto_convert boolean NOT NULL DEFAULT false,
  blocked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS mtm_login_tokens (
  token_hash text PRIMARY KEY,
  email text NOT NULL,
  registration jsonb,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mtm_login_email ON mtm_login_tokens(email,created_at);
CREATE TABLE IF NOT EXISTS mtm_sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES mtm_accounts(id),
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS mtm_subscriptions (
  stripe_id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES mtm_accounts(id),
  customer_id text NOT NULL,
  plan text NOT NULL CHECK (plan IN ('monthly','annual')),
  status text NOT NULL,
  period_start timestamptz,
  period_end timestamptz,
  paid_until timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  cancel_at timestamptz,
  canceled_at timestamptz,
  stripe_trial_start timestamptz,
  stripe_trial_end timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mtm_subscription_user ON mtm_subscriptions(user_id);
CREATE TABLE IF NOT EXISTS mtm_checkout_attempts (
  user_id uuid PRIMARY KEY REFERENCES mtm_accounts(id),
  attempt_id uuid NOT NULL,
  plan text NOT NULL,
  kind text NOT NULL,
  session_id text,
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS mtm_webhook_events (
  stripe_event_id text PRIMARY KEY,
  event_type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS mtm_billing_events (
  event_key text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES mtm_accounts(id),
  type text NOT NULL,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS mtm_library (
  id text PRIMARY KEY CHECK (id ~ '^[a-zA-Z0-9_-]{1,128}$'),
  title text NOT NULL,
  published boolean NOT NULL DEFAULT false,
  free_selection boolean NOT NULL DEFAULT false
);
COMMIT;
