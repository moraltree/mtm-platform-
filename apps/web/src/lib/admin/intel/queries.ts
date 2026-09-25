/**
 * Phase 4 read-only aggregates. Reactivation = a paid subscription confirmed
 * after a cancellation that itself followed an earlier paid subscription for
 * the same account (paid → cancelled → paid), so out-of-order events never
 * count as a comeback.
 * Every query is bounded by the snapshot instant
 * and returns counts, integer minor-unit sums, currency codes, UTC labels or
 * allowlist-checked dimension values. Registration JSON is only ever reduced
 * to the server-validated campaignId or the self-declared country code; names,
 * emails, account IDs and provider IDs are never selected.
 */

export const intelPresentSql = `SELECT to_regclass('mtm_payment_failures') IS NOT NULL
 AND to_regclass('mtm_listening_events') IS NOT NULL
 AND to_regclass('mtm_ledger_entries') IS NOT NULL AS present`;

export const coverageRowsSql = `SELECT dataset, coverage_start, method FROM mtm_analytics_coverage`;

/** Durable dated events. $2 is the snapshot instant (nothing later counts). */
const events = `
 SELECT 'registrations' AS m, created_at AS at FROM mtm_accounts
 UNION ALL SELECT 'trial_starts', trial_start FROM mtm_accounts WHERE trial_start IS NOT NULL AND trial_days > 0
 UNION ALL SELECT CASE type WHEN 'PAID_SUBSCRIPTION_CONFIRMED' THEN 'new_paid' WHEN 'SUBSCRIPTION_CANCELLED' THEN 'cancellations'
  WHEN 'PAYMENT_SUCCEEDED' THEN 'payments' WHEN 'PAYMENT_FAILED' THEN 'failed_payments' WHEN 'TRIAL_CONVERTED' THEN 'conversions' END,
  created_at FROM mtm_billing_events
  WHERE type IN ('PAID_SUBSCRIPTION_CONFIRMED','SUBSCRIPTION_CANCELLED','PAYMENT_SUCCEEDED','PAYMENT_FAILED','TRIAL_CONVERTED')
 UNION ALL SELECT CASE WHEN p.n = 1 THEN 'new_paid_accounts' ELSE 'repeat_paid' END, p.created_at FROM (
  SELECT created_at, row_number() OVER (PARTITION BY user_id ORDER BY created_at, event_key) AS n
  FROM mtm_billing_events WHERE type='PAID_SUBSCRIPTION_CONFIRMED' AND created_at <= $2) p
 UNION ALL SELECT 'reactivations', p.created_at FROM mtm_billing_events p
  WHERE p.type='PAID_SUBSCRIPTION_CONFIRMED' AND p.created_at <= $2 AND EXISTS (
   SELECT 1 FROM mtm_billing_events c WHERE c.user_id=p.user_id AND c.type='SUBSCRIPTION_CANCELLED' AND c.created_at < p.created_at
   AND EXISTS (SELECT 1 FROM mtm_billing_events p0 WHERE p0.user_id=p.user_id AND p0.type='PAID_SUBSCRIPTION_CONFIRMED' AND p0.created_at <= c.created_at))`;

/** Current window [$1,$2], comparison window [$3,$4). */
export const subscriberPeriodSql = `SELECT m AS metric,
 count(*) FILTER (WHERE at >= $1 AND at <= $2)::int AS cur,
 count(*) FILTER (WHERE at >= $3 AND at < $4)::int AS prev
 FROM (${events}) e WHERE at <= $2 GROUP BY m`;

/** Scheduled cancellations now, and newly scheduled in [$1,$2] from history. */
export const scheduledSql = `SELECT
 (SELECT count(DISTINCT s.user_id) FROM mtm_subscriptions s JOIN mtm_accounts a ON a.id=s.user_id
  WHERE s.cancel_at_period_end AND s.status IN ('active','trialing') AND NOT a.blocked)::int AS accounts_now,
 (SELECT count(*) FROM mtm_subscription_history WHERE 'cancellation_scheduled' = ANY(transitions)
  AND recorded_at >= $1 AND recorded_at <= $2)::int AS scheduled_in_window`;

/** Account-level paid state at $1 and $2 from recorded history (valid only inside coverage). */
export const historyMovementSql = `WITH s0 AS (
 SELECT DISTINCT ON (subscription_id) user_id,status,paid_until FROM mtm_subscription_history
 WHERE recorded_at <= $1 ORDER BY subscription_id, recorded_at DESC, id DESC
), s1 AS (
 SELECT DISTINCT ON (subscription_id) user_id,status,paid_until FROM mtm_subscription_history
 WHERE recorded_at <= $2 ORDER BY subscription_id, recorded_at DESC, id DESC
), o AS (SELECT DISTINCT user_id FROM s0 WHERE status='active' AND paid_until > $1),
c AS (SELECT DISTINCT user_id FROM s1 WHERE status='active' AND paid_until > $2)
SELECT (SELECT count(*) FROM o)::int AS opening, (SELECT count(*) FROM c)::int AS closing,
 (SELECT count(*) FROM o WHERE user_id NOT IN (SELECT user_id FROM c))::int AS lost,
 (SELECT count(*) FROM c WHERE user_id NOT IN (SELECT user_id FROM o))::int AS gained`;

/** Weekly (ISO Monday, UTC) event counts from $1 to $2. */
export const weeklySql = `SELECT m AS metric, to_char(date_trunc('week', at AT TIME ZONE 'UTC'),'YYYY-MM-DD') AS week, count(*)::int AS n
 FROM (${events}) e WHERE at >= $1 AND at <= $2 GROUP BY 1,2`;

/**
 * Revenue per named window and currency. $1 names, $2 starts, $3 exclusive
 * ends ('infinity' for open windows), $4 snapshot. billing_reason splits new vs renewal where recorded.
 */
export const revenueWindowsSql = `WITH w AS (SELECT * FROM unnest($1::text[], $2::timestamptz[], $3::timestamptz[]) AS w(name, s, e))
SELECT w.name, l.currency,
 count(*) FILTER (WHERE l.kind='payment' AND l.amount_minor > 0)::int AS payments,
 COALESCE(sum(l.amount_minor) FILTER (WHERE l.kind='payment'),0)::text AS gross,
 COALESCE(sum(l.amount_minor) FILTER (WHERE l.kind='payment' AND l.billing_reason='subscription_create'),0)::text AS new_gross,
 COALESCE(sum(l.amount_minor) FILTER (WHERE l.kind='payment' AND l.billing_reason='subscription_cycle'),0)::text AS renewal_gross,
 COALESCE(sum(l.amount_minor) FILTER (WHERE l.kind='payment' AND l.billing_reason IS NOT NULL AND l.billing_reason NOT IN ('subscription_create','subscription_cycle')),0)::text AS other_gross,
 COALESCE(sum(l.amount_minor) FILTER (WHERE l.kind='payment' AND l.billing_reason IS NULL),0)::text AS unclassified_gross,
 COALESCE(sum(l.amount_minor) FILTER (WHERE l.kind='payment' AND l.plan='monthly'),0)::text AS monthly_gross,
 COALESCE(sum(l.amount_minor) FILTER (WHERE l.kind='payment' AND l.plan='annual'),0)::text AS annual_gross,
 COALESCE(sum(l.amount_minor) FILTER (WHERE l.kind='refund' AND l.status='succeeded'),0)::text AS refunded,
 COALESCE(sum(l.amount_minor) FILTER (WHERE l.kind='dispute' AND l.status='lost'),0)::text AS disputes_lost
FROM w JOIN mtm_ledger_entries l ON l.provider_occurred_at >= w.s AND l.provider_occurred_at < w.e
 AND l.provider_occurred_at <= $4 AND l.recorded_at <= $4
GROUP BY w.name, l.currency`;

/** Failed invoice value per window by first failure; recovered = later ledger payment for the invoice. */
export const failureWindowsSql = `WITH w AS (SELECT * FROM unnest($1::text[], $2::timestamptz[], $3::timestamptz[]) AS w(name, s, e))
SELECT w.name, f.currency, count(*)::int AS invoices,
 COALESCE(sum(f.amount_due_minor),0)::text AS failed_value,
 COALESCE(sum(f.amount_due_minor) FILTER (WHERE EXISTS (SELECT 1 FROM mtm_ledger_entries l
  WHERE l.kind='payment' AND l.provider_invoice_id=f.provider_invoice_id AND l.recorded_at <= $4)),0)::text AS recovered_value
FROM w JOIN mtm_payment_failures f ON f.first_failed_at >= w.s AND f.first_failed_at < w.e
 AND f.first_failed_at <= $4 AND f.recorded_at <= $4
GROUP BY w.name, f.currency`;

/** Phase 2 reconciliation generalised to arbitrary windows (receipt time). */
export const reconciliationWindowsSql = `WITH w AS (SELECT * FROM unnest($1::text[], $2::timestamptz[], $3::timestamptz[]) AS w(name, s, e)),
started AS (SELECT coverage_start FROM mtm_analytics_coverage WHERE dataset='payment_ledger'),
unmatched AS (
 SELECT b.created_at, b.created_at < (SELECT coverage_start FROM started) AS before_coverage
 FROM mtm_billing_events b WHERE b.type='PAYMENT_SUCCEEDED' AND b.created_at <= $4
 AND NOT EXISTS (SELECT 1 FROM mtm_ledger_entries l WHERE l.kind='payment'
  AND l.provider_invoice_id = b.data->'details'->>'objectId' AND l.recorded_at <= $4)
), gaps AS (
 SELECT g.recorded_at FROM mtm_ledger_gaps g WHERE g.recorded_at <= $4
 AND NOT EXISTS (SELECT 1 FROM mtm_ledger_entries l WHERE l.provider_object_id=g.provider_object_id AND l.recorded_at <= $4)
)
SELECT w.name,
 (SELECT count(*) FROM unmatched u WHERE u.created_at >= w.s AND u.created_at < w.e AND u.before_coverage IS NOT FALSE)::int AS pre_coverage,
 (SELECT count(*) FROM unmatched u WHERE u.created_at >= w.s AND u.created_at < w.e AND u.before_coverage IS FALSE)::int AS unmatched,
 (SELECT count(*) FROM gaps g WHERE g.recorded_at >= w.s AND g.recorded_at < w.e)::int AS gaps
FROM w`;

/** Registration-month cohorts with outcomes to date (latest 24 months). */
export const registrationCohortsSql = `WITH a AS (
 SELECT id, date_trunc('month', created_at AT TIME ZONE 'UTC') AS cohort, blocked, trial_status,
  (trial_start IS NOT NULL AND trial_start <= $1 AND trial_days > 0) AS started
 FROM mtm_accounts WHERE created_at <= $1
), ev AS (
 SELECT user_id, type, created_at FROM mtm_billing_events
 WHERE created_at <= $1 AND type IN ('PAID_SUBSCRIPTION_CONFIRMED','TRIAL_CONVERTED','SUBSCRIPTION_CANCELLED')
), paying AS (SELECT DISTINCT user_id FROM mtm_subscriptions WHERE status='active' AND paid_until > $1),
react AS (SELECT DISTINCT p.user_id FROM ev p WHERE p.type='PAID_SUBSCRIPTION_CONFIRMED'
 AND EXISTS (SELECT 1 FROM ev c WHERE c.user_id=p.user_id AND c.type='SUBSCRIPTION_CANCELLED' AND c.created_at < p.created_at
  AND EXISTS (SELECT 1 FROM ev p0 WHERE p0.user_id=p.user_id AND p0.type='PAID_SUBSCRIPTION_CONFIRMED' AND p0.created_at <= c.created_at)))
SELECT to_char(cohort,'YYYY-MM') AS month, count(*)::int AS registered,
 count(*) FILTER (WHERE started)::int AS trials,
 count(*) FILTER (WHERE started AND (trial_status='converted' OR EXISTS (SELECT 1 FROM ev WHERE ev.user_id=a.id AND ev.type='TRIAL_CONVERTED')))::int AS converted,
 count(*) FILTER (WHERE EXISTS (SELECT 1 FROM ev WHERE ev.user_id=a.id AND ev.type='PAID_SUBSCRIPTION_CONFIRMED'))::int AS ever_paid,
 count(*) FILTER (WHERE NOT blocked AND id IN (SELECT user_id FROM paying))::int AS paying_now,
 count(*) FILTER (WHERE EXISTS (SELECT 1 FROM ev WHERE ev.user_id=a.id AND ev.type='SUBSCRIPTION_CANCELLED'))::int AS cancelled,
 count(*) FILTER (WHERE id IN (SELECT user_id FROM react))::int AS reactivated
FROM a GROUP BY cohort ORDER BY cohort DESC LIMIT 24`;

/** Trial-start-month cohorts: matured = the single platform deadline has passed. */
export const trialCohortsSql = `SELECT to_char(date_trunc('month', trial_start AT TIME ZONE 'UTC'),'YYYY-MM') AS month,
 count(*)::int AS started,
 count(*) FILTER (WHERE trial_end <= $1)::int AS matured,
 count(*) FILTER (WHERE conv)::int AS converted,
 count(*) FILTER (WHERE trial_end <= $1 AND conv)::int AS matured_converted
FROM (SELECT trial_start, trial_end, (trial_status='converted' OR EXISTS (SELECT 1 FROM mtm_billing_events b
  WHERE b.user_id=a.id AND b.type='TRIAL_CONVERTED' AND b.created_at <= $1)) AS conv
 FROM mtm_accounts a WHERE created_at <= $1 AND trial_start IS NOT NULL AND trial_start <= $1 AND trial_days > 0) t
GROUP BY 1 ORDER BY 1 DESC LIMIT 24`;

/**
 * Acquisition by the server-validated registration campaign for accounts
 * registered in [$1,$2]; outcomes to the snapshot $3. The campaign value is
 * checked against an allowlist pattern in code before display.
 */
export const campaignSql = `WITH a AS (
 SELECT id, NULLIF(registration->>'campaignId','') AS campaign, blocked, trial_status,
  (trial_start IS NOT NULL AND trial_start <= $3 AND trial_days > 0) AS started
 FROM mtm_accounts WHERE created_at >= $1 AND created_at <= $2 AND created_at <= $3
)
SELECT campaign, count(*)::int AS registrations,
 count(*) FILTER (WHERE started)::int AS trials,
 count(*) FILTER (WHERE started AND (trial_status='converted' OR EXISTS (SELECT 1 FROM mtm_billing_events b WHERE b.user_id=a.id AND b.type='TRIAL_CONVERTED' AND b.created_at <= $3)))::int AS converted,
 count(*) FILTER (WHERE EXISTS (SELECT 1 FROM mtm_billing_events b WHERE b.user_id=a.id AND b.type='PAID_SUBSCRIPTION_CONFIRMED' AND b.created_at <= $3))::int AS paid,
 count(*) FILTER (WHERE NOT blocked AND EXISTS (SELECT 1 FROM mtm_subscriptions s WHERE s.user_id=a.id AND s.status='active' AND s.paid_until > $3))::int AS paying_now
FROM a GROUP BY campaign`;

/** Net recorded ledger revenue (to the snapshot) of accounts registered in [$1,$2], by campaign and currency. */
export const campaignRevenueSql = `SELECT NULLIF(a.registration->>'campaignId','') AS campaign, l.currency,
 (COALESCE(sum(l.amount_minor) FILTER (WHERE l.kind='payment'),0)
  - COALESCE(sum(l.amount_minor) FILTER (WHERE l.kind='refund' AND l.status='succeeded'),0)
  - COALESCE(sum(l.amount_minor) FILTER (WHERE l.kind='dispute' AND l.status='lost'),0))::text AS net
FROM mtm_accounts a JOIN mtm_ledger_entries l ON l.user_id=a.id
WHERE a.created_at >= $1 AND a.created_at <= $2 AND a.created_at <= $3
 AND l.provider_occurred_at <= $3 AND l.recorded_at <= $3
GROUP BY 1,2`;

/** Self-declared registration country (raw; validated against the country list in code). */
export const countrySql = `SELECT upper(NULLIF(trim(registration->'adult'->>'country'),'')) AS code,
 count(*)::int AS registrations,
 count(*) FILTER (WHERE NOT blocked AND EXISTS (SELECT 1 FROM mtm_subscriptions s WHERE s.user_id=a.id AND s.status='active' AND s.paid_until > $3))::int AS paying_now
FROM mtm_accounts a WHERE created_at >= $1 AND created_at <= $2 AND created_at <= $3 GROUP BY 1`;

/** Listening aggregates for [$1,$2]. Only executed once listening coverage exists. */
export const listeningSummarySql = `SELECT
 count(*) FILTER (WHERE event_type='story_started')::int AS starts,
 count(*) FILTER (WHERE event_type='story_completed')::int AS completions,
 count(DISTINCT session_id)::int AS sessions,
 COALESCE(sum(listened_seconds),0)::bigint::text AS listened_seconds,
 count(*) FILTER (WHERE event_type='sleep_timer_set')::int AS sleep_timers
FROM mtm_listening_events WHERE occurred_at >= $1 AND occurred_at <= $2`;

/** Per-story ranking; replays = starts beyond each listener's first per story. */
export const listeningStoriesSql = `WITH s AS (
 SELECT story_id, listener_id, count(*) FILTER (WHERE event_type='story_started') AS starts,
  count(*) FILTER (WHERE event_type='story_completed') AS completions, sum(listened_seconds) AS secs
 FROM mtm_listening_events WHERE occurred_at >= $1 AND occurred_at <= $2 GROUP BY story_id, listener_id
)
SELECT s.story_id, COALESCE(l.title, s.story_id) AS title, COALESCE(l.story_world,'Unassigned') AS story_world,
 COALESCE(l.season,'') AS season, sum(starts)::int AS starts, sum(completions)::int AS completions,
 sum(CASE WHEN listener_id IS NOT NULL AND starts > 1 THEN starts - 1 ELSE 0 END)::int AS replays,
 COALESCE(sum(secs),0)::bigint::text AS listened_seconds
FROM s LEFT JOIN mtm_library l ON l.id=s.story_id GROUP BY 1,2,3,4 ORDER BY starts DESC, story_id LIMIT 50`;

export const listeningByHourSql = `SELECT extract(hour FROM occurred_at AT TIME ZONE 'UTC')::int AS hour,
 COALESCE(sum(listened_seconds),0)::bigint::text AS listened_seconds
FROM mtm_listening_events WHERE occurred_at >= $1 AND occurred_at <= $2 GROUP BY 1`;

export const listeningByClassSql = `SELECT listener_class, count(DISTINCT session_id)::int AS sessions,
 COALESCE(sum(listened_seconds),0)::bigint::text AS listened_seconds
FROM mtm_listening_events WHERE occurred_at >= $1 AND occurred_at <= $2 GROUP BY 1`;

/** One inventory query for the Data Coverage view: sizes and first/last dates only. */
export const inventorySql = `SELECT
 (SELECT count(*) FROM mtm_accounts WHERE created_at <= $1)::int AS accounts,
 (SELECT min(created_at) FROM mtm_accounts WHERE created_at <= $1) AS accounts_since,
 (SELECT count(*) FROM mtm_accounts WHERE created_at <= $1 AND NULLIF(registration->>'campaignId','') IS NOT NULL)::int AS with_campaign,
 (SELECT count(*) FROM mtm_accounts WHERE created_at <= $1 AND NULLIF(trim(registration->'adult'->>'country'),'') IS NOT NULL)::int AS with_country,
 (SELECT count(*) FROM mtm_billing_events WHERE created_at <= $1)::int AS billing_events,
 (SELECT min(created_at) FROM mtm_billing_events WHERE created_at <= $1) AS billing_since,
 (SELECT count(*) FROM mtm_webhook_events WHERE processed_at <= $1)::int AS receipts,
 (SELECT count(*) FROM mtm_ledger_entries WHERE recorded_at <= $1)::int AS ledger_entries,
 (SELECT count(*) FROM mtm_ledger_entries WHERE recorded_at <= $1 AND livemode)::int AS live_entries,
 (SELECT count(*) FROM mtm_ledger_entries WHERE recorded_at <= $1 AND kind='payment' AND billing_reason IS NULL)::int AS unclassified_payments,
 (SELECT count(*) FROM mtm_payment_failures WHERE recorded_at <= $1)::int AS failures,
 (SELECT count(*) FROM mtm_subscription_history WHERE recorded_at <= $1)::int AS history_rows,
 (SELECT count(*) FROM mtm_subscriptions)::int AS subscriptions,
 (SELECT count(*) FROM mtm_subscriptions WHERE status='active' AND unit_amount_minor IS NULL)::int AS active_without_contract,
 (SELECT count(*) FROM mtm_listening_events WHERE received_at <= $1)::int AS listening_events,
 (SELECT count(*) FROM mtm_library WHERE published)::int AS published_stories,
 (SELECT count(*) FROM mtm_library WHERE published AND story_world IS NOT NULL)::int AS stories_with_world`;
