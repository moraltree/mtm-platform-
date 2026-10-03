import type { FounderOverview } from "./types";

/**
 * DEVELOPMENT REVIEW FIXTURE — not business data.
 *
 * Fixed, internally-consistent figures so Stuart can review the
 * approved card layout in a populated state before any real
 * subscription records exist. Same safety layering as the approved
 * audiobook test catalogue:
 *
 * - only when FOUNDER_CONSOLE_REVIEW_FIXTURE=true is explicitly set in
 *   the server process environment;
 * - never on Vercel (VERCEL / VERCEL_ENV present → off), so it cannot
 *   reach production even if the flag were copied there;
 * - never when a real subscription-record store is configured — it can
 *   only fill the "no data" gap, never mask real figures;
 * - only ever rendered behind Founder authorization, with a persistent
 *   on-page "Development test figures — not business data" notice.
 *
 * It populates only metrics the real adapter can also produce; metrics
 * that are genuinely unavailable stay "Not yet available" here too.
 */

export function isReviewFixtureEnabled(
  env: Record<string, string | undefined>,
): boolean {
  return (
    env.FOUNDER_CONSOLE_REVIEW_FIXTURE === "true" &&
    !env.VERCEL &&
    !env.VERCEL_ENV
  );
}

const HOUR = 60 * 60 * 1000;

export function reviewFixtureOverview(
  now: Date,
  stripeTestConfigured: boolean,
): FounderOverview {
  const ago = (hours: number) => new Date(now.getTime() - hours * HOUR);
  return {
    asOf: now.toISOString(),
    source: "review-fixture",
    counts: {
      paid: 18,
      trials: 42,
      cancelled: 3,
      monthly: 13,
      annual: 5,
      trialsStarted: 57,
    },
    statuses: [
      { key: "active", count: 16 },
      { key: "canceling", count: 2 },
      { key: "trialing", count: 0 },
      { key: "platform_trial", count: 42 },
      { key: "platform_trial_expired", count: 9 },
      { key: "past_due", count: 1 },
      { key: "unpaid", count: 0 },
      { key: "paused", count: 0 },
      { key: "incomplete", count: 2 },
      { key: "cancelled", count: 3 },
      { key: "trial_closed", count: 6 },
      { key: "other", count: 0 },
    ],
    activity: [
      { kind: "trial", at: ago(1).toISOString() },
      { kind: "subscription", at: ago(3).toISOString() },
      { kind: "trial", at: ago(5).toISOString() },
      { kind: "trial", at: ago(9).toISOString() },
      { kind: "cancellation", at: ago(20).toISOString() },
      { kind: "subscription", at: ago(26).toISOString() },
      { kind: "trial", at: ago(31).toISOString() },
      { kind: "subscription", at: ago(50).toISOString() },
    ],
    health: {
      stripeTestConfigured,
      lastStripeUpdate: ago(3).toISOString(),
    },
  };
}
