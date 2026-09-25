/**
 * Phase 3 read-only trend/comparison aggregates over durable Phase 1/2
 * records. $1 is always the snapshot instant. Rows carry metric names, UTC
 * dates and counts/amounts only: never email, registration JSON, provider IDs
 * or payloads.
 */
const EVENT_METRICS = `CASE type
 WHEN 'PAID_SUBSCRIPTION_CONFIRMED' THEN 'new_paid'
 WHEN 'SUBSCRIPTION_CANCELLED' THEN 'cancellations'
 WHEN 'PAYMENT_SUCCEEDED' THEN 'payments'
 WHEN 'PAYMENT_FAILED' THEN 'failed_payments'
 WHEN 'TRIAL_CONVERTED' THEN 'conversions' END`;
const EVENT_TYPES = `('PAID_SUBSCRIPTION_CONFIRMED','SUBSCRIPTION_CANCELLED','PAYMENT_SUCCEEDED','PAYMENT_FAILED','TRIAL_CONVERTED')`;

/** Every dated event in one stream: registrations, trial starts, billing events (receipt time). */
const events = `SELECT 'registrations' AS metric, created_at AS at FROM mtm_accounts
 UNION ALL SELECT 'trial_starts', trial_start FROM mtm_accounts WHERE trial_start IS NOT NULL AND trial_days > 0
 UNION ALL SELECT ${EVENT_METRICS}, created_at FROM mtm_billing_events WHERE type IN ${EVENT_TYPES}`;

/** Daily counts per UTC date for [$2, $1]. Missing days are zero and filled in code. */
export const dailySeriesSql = `SELECT metric, to_char(at AT TIME ZONE 'UTC','YYYY-MM-DD') AS day, count(*)::int AS n
 FROM (${events}) e WHERE at >= $2 AND at <= $1 GROUP BY 1,2`;

/** Equal-length instant windows ending at the snapshot, so a partial day never skews a comparison. */
export const comparisonSql = `SELECT metric,
 count(*) FILTER (WHERE at > $1::timestamptz - interval '7 days')::int AS cur7,
 count(*) FILTER (WHERE at > $1::timestamptz - interval '14 days' AND at <= $1::timestamptz - interval '7 days')::int AS prev7,
 count(*) FILTER (WHERE at > $1::timestamptz - interval '30 days')::int AS cur30,
 count(*) FILTER (WHERE at <= $1::timestamptz - interval '30 days')::int AS prev30
 FROM (${events}) e WHERE at <= $1 AND at > $1::timestamptz - interval '60 days' GROUP BY metric`;

export const funnelSql = `SELECT
 (SELECT count(DISTINCT user_id) FROM mtm_billing_events WHERE type='PAID_SUBSCRIPTION_CONFIRMED' AND created_at <= $1)::int AS ever_paid,
 (SELECT min(created_at) FROM mtm_accounts WHERE created_at <= $1) AS data_start`;

export const webhookRecencySql = `SELECT
 count(*) FILTER (WHERE processed_at > $1::timestamptz - interval '24 hours')::int AS last24h,
 count(*) FILTER (WHERE processed_at > $1::timestamptz - interval '7 days')::int AS last7d
 FROM mtm_webhook_events WHERE processed_at <= $1`;

/** Ledger objects never successfully recorded (Phase 2 tables; only run when present). */
export const openGapsSql = `SELECT count(*)::int AS open FROM mtm_ledger_gaps g WHERE g.recorded_at <= $1
 AND NOT EXISTS (SELECT 1 FROM mtm_ledger_entries l WHERE l.provider_object_id=g.provider_object_id AND l.recorded_at <= $1)`;

/** Gross successful payments per currency and UTC date for [$2, $1] (Phase 2 ledger). */
export const revenueSeriesSql = `SELECT currency, to_char(provider_occurred_at AT TIME ZONE 'UTC','YYYY-MM-DD') AS day,
 COALESCE(sum(amount_minor),0)::text AS gross, count(*) FILTER (WHERE amount_minor > 0)::int AS payments
 FROM mtm_ledger_entries WHERE kind='payment' AND provider_occurred_at >= $2
 AND provider_occurred_at <= $1 AND recorded_at <= $1 GROUP BY 1,2`;

/** Executive activity feed: generic kinds and UTC instants only. */
export const feedSql = `SELECT kind, occurred_at FROM (
 SELECT 'registration' AS kind, created_at AS occurred_at FROM mtm_accounts WHERE created_at <= $1
 UNION ALL
 SELECT CASE type WHEN 'PAYMENT_SUCCEEDED' THEN 'payment' WHEN 'PAYMENT_FAILED' THEN 'payment_failed'
  WHEN 'TRIAL_STARTED' THEN 'trial_started' WHEN 'TRIAL_CONVERTED' THEN 'conversion'
  WHEN 'SUBSCRIPTION_CANCELLED' THEN 'cancellation' WHEN 'REFUND' THEN 'refund'
  WHEN 'CHARGEBACK' THEN 'dispute' WHEN 'PAID_SUBSCRIPTION_CONFIRMED' THEN 'new_paid' END,
  created_at FROM mtm_billing_events
 WHERE type IN ('PAYMENT_SUCCEEDED','PAYMENT_FAILED','TRIAL_STARTED','TRIAL_CONVERTED','SUBSCRIPTION_CANCELLED','REFUND','CHARGEBACK','PAID_SUBSCRIPTION_CONFIRMED')
 AND created_at <= $1
) feed ORDER BY occurred_at DESC, kind LIMIT 25`;
