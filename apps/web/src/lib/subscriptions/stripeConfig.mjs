/**
 * Stripe TEST configuration validation for content subscriptions (Phase 5).
 *
 * Shared by lib/subscriptions/config.ts (runtime, fails closed) and
 * scripts/check-subscriptions.mjs (operator readiness check). Plain
 * JavaScript so both can use it. Messages name variables, never values.
 *
 * Canonical variable names are the ones BOTH historical code lines read:
 * STRIPE_PRICE_MONTHLY / STRIPE_PRICE_ANNUAL (Phase 1-4 config.ts and the
 * superseded production commit 6746516's subscriptionPlans.ts). The
 * STRIPE_MONTHLY_PRICE_ID / STRIPE_ANNUAL_PRICE_ID names exist only in
 * environment configuration and were never read by any code, so their
 * presence means the environment is inconsistent: refuse rather than guess
 * which Price (or which Stripe account) was intended.
 */

export const LEGACY_VARIABLES = {
  STRIPE_MONTHLY_PRICE_ID: "STRIPE_PRICE_MONTHLY",
  STRIPE_ANNUAL_PRICE_ID: "STRIPE_PRICE_ANNUAL",
  STRIPE_TRIAL_PERIOD_DAYS: "DEFAULT_TRIAL_DAYS",
};

const TEST_KEY = /^(sk|rk)_test_[A-Za-z0-9]{10,}$/;
const WEBHOOK_SECRET = /^whsec_[A-Za-z0-9+/=_-]{16,}$/;
const PRICE = /^price_[A-Za-z0-9]{8,}$/;
const ACCOUNT = /^acct_[A-Za-z0-9]{8,}$/;

/**
 * Returns every problem with the Stripe TEST configuration; empty when
 * consistent. Never includes a value in a message.
 *
 * @param {Record<string, string | undefined>} [env]
 * @returns {string[]}
 */
export function stripeConfigIssues(
  env = /** @type {Record<string, string | undefined>} */ (process.env),
) {
  const issues = [];
  const key = env.STRIPE_SECRET_KEY;
  if (!key) issues.push("STRIPE_SECRET_KEY is missing");
  else if (/^(sk|rk)_live_/.test(key))
    issues.push("STRIPE_SECRET_KEY is a LIVE key; only TEST keys are accepted");
  else if (!TEST_KEY.test(key))
    issues.push(
      "STRIPE_SECRET_KEY is not a Stripe TEST secret or restricted key",
    );
  if (!env.STRIPE_WEBHOOK_SECRET)
    issues.push("STRIPE_WEBHOOK_SECRET is missing");
  else if (!WEBHOOK_SECRET.test(env.STRIPE_WEBHOOK_SECRET))
    issues.push("STRIPE_WEBHOOK_SECRET is not a Stripe signing secret");
  if (!env.STRIPE_ACCOUNT_ID)
    issues.push("STRIPE_ACCOUNT_ID is missing (the intended TEST account)");
  else if (!ACCOUNT.test(env.STRIPE_ACCOUNT_ID))
    issues.push("STRIPE_ACCOUNT_ID is not a Stripe account ID");
  for (const name of ["STRIPE_PRICE_MONTHLY", "STRIPE_PRICE_ANNUAL"]) {
    if (!env[name]) issues.push(`${name} is missing`);
    else if (!PRICE.test(env[name])) issues.push(`${name} is not a Price ID`);
  }
  if (
    env.STRIPE_PRICE_MONTHLY &&
    env.STRIPE_PRICE_MONTHLY === env.STRIPE_PRICE_ANNUAL
  )
    issues.push("STRIPE_PRICE_MONTHLY and STRIPE_PRICE_ANNUAL must differ");
  for (const [legacy, canonical] of Object.entries(LEGACY_VARIABLES))
    if (env[legacy] !== undefined)
      issues.push(
        `${legacy} is set but is not read by any code; remove it (canonical: ${canonical})`,
      );
  return issues;
}

/**
 * Throws one aggregated, value-free error when the configuration is inconsistent.
 * @param {Record<string, string | undefined>} [env]
 */
export function assertStripeConfig(
  env = /** @type {Record<string, string | undefined>} */ (process.env),
) {
  const issues = stripeConfigIssues(env);
  if (issues.length)
    throw new Error(`Stripe test configuration invalid: ${issues.join("; ")}`);
}
