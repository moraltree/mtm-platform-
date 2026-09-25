/**
 * Phase 2 read-only finance/lifecycle aggregates. Parameters: $1 snapshot
 * instant, $2 today, $3 week, $4 month (UTC starts). Rows are bounded by both
 * provider occurrence and local recording time so a snapshot is repeatable.
 * Never select email, registration JSON, provider IDs or payloads.
 */
const windows = `w(period,start) AS (VALUES ('today',$2::timestamptz),('week',$3::timestamptz),('month',$4::timestamptz),('lifetime','-infinity'::timestamptz))`;

export const ledgerPresentSql = `SELECT to_regclass('mtm_ledger_entries') IS NOT NULL
 AND to_regclass('mtm_analytics_coverage') IS NOT NULL
 AND to_regclass('mtm_subscription_history') IS NOT NULL AS present`;

export const coverageSql = `SELECT dataset, coverage_start, method FROM mtm_analytics_coverage`;

export const revenueSql = `WITH ${windows}
SELECT w.period, l.currency,
 count(*) FILTER (WHERE l.kind='payment' AND l.amount_minor>0)::int AS payments,
 COALESCE(sum(l.amount_minor) FILTER (WHERE l.kind='payment'),0)::text AS gross,
 COALESCE(sum(l.amount_minor) FILTER (WHERE l.kind='refund' AND l.status='succeeded'),0)::text AS refunded,
 count(*) FILTER (WHERE l.kind='refund' AND l.status NOT IN ('succeeded','failed','canceled'))::int AS pending_refunds,
 COALESCE(sum(l.amount_minor) FILTER (WHERE l.kind='dispute' AND l.status='lost'),0)::text AS disputes_lost,
 count(*) FILTER (WHERE l.kind='dispute' AND l.status NOT IN ('won','lost','prevented','warning_closed'))::int AS open_disputes
FROM w JOIN mtm_ledger_entries l ON l.provider_occurred_at >= w.start
 AND l.provider_occurred_at <= $1 AND l.recorded_at <= $1
GROUP BY w.period, l.currency ORDER BY w.period, l.currency`;

/** Gross successful payments by plan attributed at payment time ($1 snapshot, $2 month start). Refunds are not split by plan. */
export const planRevenueSql = `SELECT currency, COALESCE(plan,'unattributed') AS plan,
 count(*) FILTER (WHERE provider_occurred_at >= $2)::int AS month_payments,
 COALESCE(sum(amount_minor) FILTER (WHERE provider_occurred_at >= $2),0)::text AS month,
 count(*)::int AS lifetime_payments,
 COALESCE(sum(amount_minor),0)::text AS lifetime
FROM mtm_ledger_entries
WHERE kind='payment' AND amount_minor>0 AND provider_occurred_at <= $1 AND recorded_at <= $1
GROUP BY 1,2 ORDER BY 1,2`;

/**
 * Reconciliation against Phase 1's durable PAYMENT_SUCCEEDED receipts (grouped
 * by receipt time). Receipts without a ledger amount are split into those
 * before ledger coverage began (expected until a backfill) and those after it
 * (anomalies). Gaps count only objects never subsequently recorded.
 */
export const reconciliationSql = `WITH ${windows},
started AS (SELECT coverage_start FROM mtm_analytics_coverage WHERE dataset='payment_ledger'),
unmatched AS (
 SELECT b.created_at, b.created_at < (SELECT coverage_start FROM started) AS before_coverage
 FROM mtm_billing_events b
 WHERE b.type='PAYMENT_SUCCEEDED' AND b.created_at <= $1
 AND NOT EXISTS (SELECT 1 FROM mtm_ledger_entries l WHERE l.kind='payment'
  AND l.provider_invoice_id = b.data->'details'->>'objectId' AND l.recorded_at <= $1)
), gaps AS (
 SELECT g.recorded_at FROM mtm_ledger_gaps g WHERE g.recorded_at <= $1
 AND NOT EXISTS (SELECT 1 FROM mtm_ledger_entries l WHERE l.provider_object_id=g.provider_object_id AND l.recorded_at <= $1)
)
SELECT w.period,
 (SELECT count(*) FROM unmatched u WHERE u.created_at >= w.start AND u.before_coverage IS NOT FALSE)::int AS pre_coverage,
 (SELECT count(*) FROM unmatched u WHERE u.created_at >= w.start AND u.before_coverage IS FALSE)::int AS unmatched,
 (SELECT count(*) FROM gaps g WHERE g.recorded_at >= w.start)::int AS gaps
FROM w`;

export const ledgerModeSql = `SELECT count(*) FILTER (WHERE NOT livemode)::int AS test_entries,
 count(*) FILTER (WHERE livemode)::int AS live_entries
 FROM mtm_ledger_entries WHERE recorded_at <= $1`;

/** MRR uses the Phase 1 paying definition: active, future paid-through, unblocked account. */
export const mrrSql = `WITH paying AS (
 SELECT s.* FROM mtm_subscriptions s JOIN mtm_accounts a ON a.id=s.user_id
 WHERE s.status='active' AND s.paid_until > $1 AND NOT a.blocked
), priced AS (
 SELECT * FROM paying WHERE unit_amount_minor IS NOT NULL AND currency IS NOT NULL
 AND billing_interval IN ('month','year') AND interval_count > 0 AND quantity > 0 AND discounted IS FALSE
)
SELECT NULL::text AS currency, (SELECT count(*) FROM paying)::int AS subscriptions,
 (SELECT count(*) FROM priced)::int AS priced, NULL::text AS mrr, NULL::text AS canceling
UNION ALL
SELECT currency, count(*)::int, count(*)::int,
 sum(unit_amount_minor::numeric*quantity/(interval_count*CASE billing_interval WHEN 'year' THEN 12 ELSE 1 END))::text,
 COALESCE(sum(unit_amount_minor::numeric*quantity/(interval_count*CASE billing_interval WHEN 'year' THEN 12 ELSE 1 END)) FILTER (WHERE cancel_at_period_end),0)::text
FROM priced GROUP BY currency`;

/** Lifecycle counts from durable billing events (receipt time) plus coverage-bound history. */
export const lifecycleSql = `WITH ${windows},
paid AS (
 SELECT user_id, created_at,
 row_number() OVER (PARTITION BY user_id ORDER BY created_at, event_key) AS n
 FROM mtm_billing_events WHERE type='PAID_SUBSCRIPTION_CONFIRMED' AND created_at <= $1
)
SELECT w.period,
 (SELECT count(*) FROM paid WHERE created_at >= w.start)::int AS new_paid_subscriptions,
 (SELECT count(*) FROM paid WHERE n=1 AND created_at >= w.start)::int AS new_paid_accounts,
 (SELECT count(*) FROM paid WHERE n>1 AND created_at >= w.start)::int AS returning_paid,
 (SELECT count(*) FROM mtm_billing_events WHERE type='SUBSCRIPTION_CANCELLED' AND created_at >= w.start AND created_at <= $1)::int AS cancellations,
 (SELECT count(*) FROM mtm_billing_events WHERE type='TRIAL_CONVERTED' AND created_at >= w.start AND created_at <= $1)::int AS conversions,
 (SELECT count(*) FROM mtm_subscription_history WHERE 'cancellation_scheduled'=ANY(transitions) AND recorded_at >= w.start AND recorded_at <= $1)::int AS scheduled_cancellations
FROM w`;

/** Trials whose single platform deadline has passed; converted uses Phase 1's predicate. */
export const maturedTrialsSql = `SELECT count(*)::int AS matured,
 count(*) FILTER (WHERE trial_status='converted' OR EXISTS(SELECT 1 FROM mtm_billing_events b
  WHERE b.user_id=a.id AND b.type='TRIAL_CONVERTED' AND b.created_at<=$1))::int AS converted
 FROM mtm_accounts a
 WHERE created_at<=$1 AND trial_start IS NOT NULL AND trial_start<=$1 AND trial_days>0 AND trial_end<=$1`;

/**
 * Account-level paid churn for [$1,$2): accounts with paid access at the
 * opening instant that have none at the closing instant, using the latest
 * recorded history state at or before each instant.
 */
export const churnSql = `WITH s0 AS (
 SELECT DISTINCT ON (subscription_id) user_id,status,paid_until FROM mtm_subscription_history
 WHERE recorded_at <= $1 ORDER BY subscription_id, recorded_at DESC, id DESC
), s1 AS (
 SELECT DISTINCT ON (subscription_id) user_id,status,paid_until FROM mtm_subscription_history
 WHERE recorded_at <= $2 ORDER BY subscription_id, recorded_at DESC, id DESC
), opening AS (SELECT DISTINCT user_id FROM s0 WHERE status='active' AND paid_until > $1),
closing AS (SELECT DISTINCT user_id FROM s1 WHERE status='active' AND paid_until > $2)
SELECT (SELECT count(*) FROM opening)::int AS opening,
 (SELECT count(*) FROM opening o WHERE NOT EXISTS (SELECT 1 FROM closing c WHERE c.user_id=o.user_id))::int AS churned,
 (SELECT count(*) FROM closing)::int AS closing`;
