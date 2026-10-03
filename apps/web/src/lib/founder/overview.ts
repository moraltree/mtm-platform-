import "server-only";
import { sanityWriteClient } from "@/lib/sanity/writeClient";
import { requireFounder, type FounderAccess } from "./auth";
import { isReviewFixtureEnabled, reviewFixtureOverview } from "./fixture";
import {
  STATUS_KEYS,
  type ActivityKind,
  type FounderCounts,
  type FounderOverview,
  type StatusKey,
} from "./types";

/**
 * Founder overview data — read-only aggregates over the application's
 * own Sanity `subscription` records (written by the WP17 Stripe webhook
 * and by `lib/trialRegistration.ts`). This replaces the historical
 * console's PostgreSQL queries: that data store doesn't exist in this
 * redevelopment, and this phase deliberately connects no new database.
 *
 * - Authorization runs first; a denied caller never triggers a query.
 * - The GROQ returns counts and bare timestamps only. It never projects
 *   customerEmail, correlationRef, document IDs, or any Stripe ID.
 * - Reads use the server-only token client (the same client
 *   `lib/trialEligibility.ts` already reads subscription records with),
 *   because those records aren't public content. Queries only — no
 *   mutation API is called anywhere in this module.
 * - Failures return a generic "unavailable"; error details are never
 *   serialized to the page.
 *
 * "Stripe-backed" below means the record came from a Stripe Checkout
 * (`stripeCheckoutSessionId` defined); records without it are
 * platform trials (WP17's card-free 30-day trial).
 */

const S = "defined(stripeCheckoutSessionId)";
const SUB = `_type == "subscription"`;
const CANCELING = `${S} && cancelAtPeriodEnd == true && status in ["active", "trialing"]`;

export const OVERVIEW_QUERY = `{
  "paid": count(*[${SUB} && status == "active"]),
  "trials": count(*[${SUB} && !${S} && status == "trialing" && (!defined(trialEnd) || dateTime(trialEnd) > dateTime($now))]),
  "cancelled": count(*[${SUB} && ${S} && status == "cancelled"]),
  "monthly": count(*[${SUB} && status == "active" && plan == "MONTHLY"]),
  "annual": count(*[${SUB} && status == "active" && plan == "ANNUAL"]),
  "trialsStarted": count(*[${SUB} && !${S} && defined(trialStartedAt)]),
  "total": count(*[${SUB}]),
  "status": {
    "canceling": count(*[${SUB} && ${CANCELING}]),
    "active": count(*[${SUB} && status == "active" && !(${CANCELING})]),
    "trialing": count(*[${SUB} && ${S} && status == "trialing" && !(${CANCELING})]),
    "platform_trial": count(*[${SUB} && !${S} && status == "trialing" && (!defined(trialEnd) || dateTime(trialEnd) > dateTime($now))]),
    "platform_trial_expired": count(*[${SUB} && !${S} && status == "trialing" && defined(trialEnd) && dateTime(trialEnd) <= dateTime($now)]),
    "past_due": count(*[${SUB} && status == "past_due"]),
    "unpaid": count(*[${SUB} && status == "unpaid"]),
    "paused": count(*[${SUB} && status == "paused"]),
    "incomplete": count(*[${SUB} && status == "incomplete"]),
    "cancelled": count(*[${SUB} && ${S} && status == "cancelled"]),
    "trial_closed": count(*[${SUB} && !${S} && status == "cancelled"])
  },
  "recentTrials": *[${SUB} && !${S} && defined(trialStartedAt)] | order(trialStartedAt desc)[0...20].trialStartedAt,
  "recentSubscriptions": *[${SUB} && ${S} && defined(createdAt)] | order(createdAt desc)[0...20].createdAt,
  "recentCancellations": *[${SUB} && ${S} && defined(cancelledAt)] | order(cancelledAt desc)[0...20].cancelledAt,
  "lastStripeUpdate": *[${SUB} && defined(lastStripeEventId) && defined(updatedAt)] | order(updatedAt desc)[0].updatedAt
}`;

interface OverviewQueryResult extends FounderCounts {
  total: number;
  status: Record<Exclude<StatusKey, "other">, number>;
  recentTrials: (string | null)[] | null;
  recentSubscriptions: (string | null)[] | null;
  recentCancellations: (string | null)[] | null;
  lastStripeUpdate: string | null;
}

const ACTIVITY_LIMIT = 20;
const QUERY_TIMEOUT_MS = 5000;

export function isStripeTestConfigured(
  env: Record<string, string | undefined>,
): boolean {
  return (
    /^(sk|rk)_test_\w+$/.test(env.STRIPE_SECRET_KEY ?? "") &&
    /^whsec_\w+$/.test(env.STRIPE_WEBHOOK_SECRET ?? "") &&
    Boolean(
      env.STRIPE_PRICE_MONTHLY?.startsWith("price_") &&
      env.STRIPE_PRICE_ANNUAL?.startsWith("price_") &&
      env.STRIPE_PRICE_MONTHLY !== env.STRIPE_PRICE_ANNUAL,
    )
  );
}

const count = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;

function validTimestamps(values: (string | null)[] | null | undefined) {
  return (values ?? []).filter(
    (v): v is string => typeof v === "string" && !Number.isNaN(Date.parse(v)),
  );
}

export function toOverview(
  raw: OverviewQueryResult,
  now: Date,
  stripeTestConfigured: boolean,
): FounderOverview {
  const buckets = STATUS_KEYS.filter((key) => key !== "other").map((key) => ({
    key,
    count: count(raw.status?.[key]),
  }));
  const bucketed = buckets.reduce((sum, b) => sum + b.count, 0);
  const statuses = [
    ...buckets,
    { key: "other" as const, count: Math.max(0, count(raw.total) - bucketed) },
  ];

  const tag = (kind: ActivityKind) => (at: string) => ({
    kind,
    at: new Date(at).toISOString(),
  });
  const activity = [
    ...validTimestamps(raw.recentTrials).map(tag("trial")),
    ...validTimestamps(raw.recentSubscriptions).map(tag("subscription")),
    ...validTimestamps(raw.recentCancellations).map(tag("cancellation")),
  ]
    .sort((a, b) => b.at.localeCompare(a.at) || a.kind.localeCompare(b.kind))
    .slice(0, ACTIVITY_LIMIT);

  const [lastStripeUpdate] = validTimestamps([raw.lastStripeUpdate]);

  return {
    asOf: now.toISOString(),
    source: "subscription-records",
    counts: {
      paid: count(raw.paid),
      trials: count(raw.trials),
      cancelled: count(raw.cancelled),
      monthly: count(raw.monthly),
      annual: count(raw.annual),
      trialsStarted: count(raw.trialsStarted),
    },
    statuses,
    activity,
    health: {
      stripeTestConfigured,
      lastStripeUpdate: lastStripeUpdate
        ? new Date(lastStripeUpdate).toISOString()
        : null,
    },
  };
}

export async function readFounderOverview(
  now = new Date(),
): Promise<FounderOverview> {
  const stripeTestConfigured = isStripeTestConfigured(process.env);
  if (!sanityWriteClient) {
    if (isReviewFixtureEnabled(process.env))
      return reviewFixtureOverview(now, stripeTestConfigured);
    return {
      asOf: now.toISOString(),
      source: "not-configured",
      counts: null,
      statuses: null,
      activity: null,
      health: { stripeTestConfigured, lastStripeUpdate: null },
    };
  }
  const raw = await sanityWriteClient.fetch<OverviewQueryResult>(
    OVERVIEW_QUERY,
    { now: now.toISOString() },
    { signal: AbortSignal.timeout(QUERY_TIMEOUT_MS) },
  );
  return toOverview(raw, now, stripeTestConfigured);
}

export type FounderOverviewResult =
  | { status: "denied" }
  | { status: "unavailable"; access: FounderAccess }
  | { status: "ready"; access: FounderAccess; overview: FounderOverview };

export async function getFounderOverview(): Promise<FounderOverviewResult> {
  const access = await requireFounder();
  if (!access) return { status: "denied" };
  try {
    return { status: "ready", access, overview: await readFounderOverview() };
  } catch {
    // Never serialize/log provider errors, tokens or record contents.
    return { status: "unavailable", access };
  }
}
