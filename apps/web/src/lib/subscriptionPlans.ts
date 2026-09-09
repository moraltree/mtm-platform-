/**
 * Internal plan identifiers for Moral Tree Media subscriptions.
 * These are the only values the browser is ever allowed to submit.
 *
 * The server maps them to Stripe Price IDs via environment variables —
 * the browser never sees or supplies a real Stripe Price ID.
 * See CHECKOUT SECURITY in the engineering brief.
 */

export type SubscriptionPlan = "MONTHLY" | "ANNUAL";

const VALID_PLANS = new Set<string>(["MONTHLY", "ANNUAL"]);

export function isValidPlan(value: unknown): value is SubscriptionPlan {
  return typeof value === "string" && VALID_PLANS.has(value);
}

const PLAN_PRICE_ENV: Record<SubscriptionPlan, string> = {
  MONTHLY: "STRIPE_PRICE_MONTHLY",
  ANNUAL: "STRIPE_PRICE_ANNUAL",
};

/**
 * Resolves a plan identifier to the configured Stripe Price ID.
 * Returns `null` when the corresponding env var is unset — callers
 * must treat this as "not configured yet" and degrade honestly.
 *
 * Called server-side only — never exposes the Price ID to the browser.
 */
export function getPriceIdForPlan(plan: SubscriptionPlan): string | null {
  return process.env[PLAN_PRICE_ENV[plan]] ?? null;
}

export const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  MONTHLY: "Monthly",
  ANNUAL: "Annual",
};

/**
 * True only when BOTH Price IDs are configured — the subscribe page
 * shows the checkout form only when this is true.
 */
export function areSubscriptionPlansConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_PRICE_MONTHLY && process.env.STRIPE_PRICE_ANNUAL,
  );
}
