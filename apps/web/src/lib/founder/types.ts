/**
 * The Founder Console's overview snapshot. Counts only — no emails,
 * names, document IDs, Stripe IDs, or other personal data ever enter
 * this shape.
 *
 * Metrics this phase can't calculate reliably from data the application
 * genuinely holds (registered accounts, revenue, MRR, payment-event
 * counts, conversion, churn, geography, webhook delivery history,
 * duplicate protection, failed payments) are not in this type at all:
 * the Dashboard renders them as the approved "Not yet available" cards,
 * so no code path can accidentally fill them with a zero.
 */

export type FounderDataSource =
  /** Live Sanity `subscription` records (read-only aggregates). */
  | "subscription-records"
  /** No subscription-record store is configured in this environment. */
  | "not-configured"
  /** Clearly-labelled development figures for private visual review. */
  | "review-fixture";

export const STATUS_KEYS = [
  "active",
  "canceling",
  "trialing",
  "platform_trial",
  "platform_trial_expired",
  "past_due",
  "unpaid",
  "paused",
  "incomplete",
  "cancelled",
  "trial_closed",
  "other",
] as const;
export type StatusKey = (typeof STATUS_KEYS)[number];

export type ActivityKind = "trial" | "subscription" | "cancellation";

export interface FounderCounts {
  /** Records with status "active" (paid access, incl. canceling). */
  paid: number;
  /** Platform trials with status "trialing" and an unexpired trialEnd. */
  trials: number;
  /** Stripe-backed subscription records with status "cancelled". */
  cancelled: number;
  monthly: number;
  annual: number;
  /** Platform trial records with a recorded trialStartedAt. */
  trialsStarted: number;
}

export interface FounderOverview {
  asOf: string;
  source: FounderDataSource;
  /** `null` when `source` is "not-configured". */
  counts: FounderCounts | null;
  statuses: { key: StatusKey; count: number }[] | null;
  activity: { kind: ActivityKind; at: string }[] | null;
  health: {
    stripeTestConfigured: boolean;
    /** Latest updatedAt on a Stripe-written record; null if none. */
    lastStripeUpdate: string | null;
  };
}
