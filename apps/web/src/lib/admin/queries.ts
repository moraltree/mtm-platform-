/** Read-only aggregate queries. Never select email, registration JSON, tokens or provider payloads. */
export const countsSql = `
WITH eligible AS (
 SELECT DISTINCT user_id FROM mtm_subscriptions
 WHERE status='active' AND paid_until>$1
), cohort AS (
 SELECT a.*, EXISTS(SELECT 1 FROM eligible e WHERE e.user_id=a.id) AS paid,
 (trial_start IS NOT NULL AND trial_start<=$1 AND trial_days>0) AS started
 FROM mtm_accounts a WHERE created_at<=$1
)
SELECT
 count(*)::int AS accounts,
 count(*) FILTER (WHERE NOT blocked AND paid)::int AS paid,
 count(*) FILTER (WHERE NOT blocked AND NOT paid AND trial_status='active' AND trial_end>$1)::int AS trials,
 count(*) FILTER (WHERE EXISTS(SELECT 1 FROM mtm_subscriptions s WHERE s.user_id=cohort.id AND s.status='canceled'))::int AS canceled_accounts,
 count(*) FILTER (WHERE started)::int AS trials_started,
 count(*) FILTER (WHERE started AND (trial_status='converted' OR EXISTS(SELECT 1 FROM mtm_billing_events b WHERE b.user_id=cohort.id AND b.type='TRIAL_CONVERTED' AND b.created_at<=$1)))::int AS converted,
 count(*) FILTER (WHERE NOT blocked AND EXISTS(SELECT 1 FROM mtm_subscriptions s WHERE s.user_id=cohort.id AND s.status='active' AND s.paid_until>$1 AND s.plan='monthly'))::int AS monthly,
 count(*) FILTER (WHERE NOT blocked AND EXISTS(SELECT 1 FROM mtm_subscriptions s WHERE s.user_id=cohort.id AND s.status='active' AND s.paid_until>$1 AND s.plan='annual'))::int AS annual
FROM cohort`;

export const statusSql = `SELECT
 CASE WHEN cancel_at_period_end AND status IN ('active','trialing') THEN 'canceling'
 WHEN status IN ('active','trialing','canceled','past_due','unpaid','paused','incomplete','incomplete_expired') THEN status
 ELSE 'other' END AS status, count(*)::int AS count
 FROM mtm_subscriptions GROUP BY 1 ORDER BY 1`;

export const paymentsSql = `SELECT
 count(*) FILTER (WHERE created_at >= $2)::int AS today,
 count(*) FILTER (WHERE created_at >= $3)::int AS week,
 count(*) FILTER (WHERE created_at >= $4)::int AS month,
 count(*)::int AS lifetime
 FROM mtm_billing_events WHERE type='PAYMENT_SUCCEEDED' AND created_at <= $1`;

export const activitySql = `SELECT kind, occurred_at FROM (
 SELECT 'registration' AS kind, created_at AS occurred_at FROM mtm_accounts WHERE created_at <= $1
 UNION ALL
 SELECT CASE type WHEN 'PAYMENT_SUCCEEDED' THEN 'payment' WHEN 'TRIAL_CONVERTED' THEN 'conversion' ELSE 'cancellation' END AS kind,
 created_at AS occurred_at FROM mtm_billing_events
 WHERE type IN ('PAYMENT_SUCCEEDED','TRIAL_CONVERTED','SUBSCRIPTION_CANCELLED') AND created_at <= $1
 ) activity ORDER BY occurred_at DESC, kind LIMIT 20`;

export const healthSql = `SELECT
 (SELECT max(processed_at) FROM mtm_webhook_events WHERE processed_at<=$1) AS last_webhook,
 (SELECT count(*)::int FROM mtm_webhook_events WHERE processed_at<=$1) AS receipts,
 (SELECT count(*)::int FROM mtm_billing_events WHERE type='PAYMENT_FAILED' AND created_at<=$1) AS failed_payments,
 EXISTS(SELECT 1 FROM pg_constraint c WHERE c.conrelid='mtm_webhook_events'::regclass AND c.contype='p' AND
 c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=c.conrelid AND attname='stripe_event_id')]::smallint[]) AS receipt_key,
 EXISTS(SELECT 1 FROM pg_constraint c WHERE c.conrelid='mtm_billing_events'::regclass AND c.contype='p' AND
 c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=c.conrelid AND attname='event_key')]::smallint[]) AS billing_key`;
