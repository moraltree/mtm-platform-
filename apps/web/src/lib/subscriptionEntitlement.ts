import { stripe } from "./stripe";
import { sanityWriteClient } from "./sanity/writeClient";
import type { SubscriptionPlan } from "./subscriptionPlans";

/**
 * The trusted server-side entitlement check for Moral Tree Media paid
 * subscriptions. Always runs server-side — never trusts localStorage,
 * URL parameters, or success redirects alone.
 *
 * Status semantics:
 *   active    — subscription is paid and current (or trialing with card on file)
 *   trialing  — in a Stripe-managed free trial
 *   past_due  — payment failed; grace period may still grant access (Stripe policy)
 *   incomplete — checkout session completed but subscription not yet confirmed
 *   cancelled  — subscription was cancelled or never successfully paid
 *   unknown    — no record found (new visitor, or Sanity/Stripe not configured)
 */
export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "incomplete"
  | "cancelled"
  | "unknown";

export interface SubscriptionRecord {
  status: SubscriptionStatus;
  plan?: SubscriptionPlan;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

/** Internal Sanity document shape — the minimum fields needed for
 * entitlement decisions. */
interface SanitySubscriptionDoc {
  status: string;
  plan?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

function normaliseSanityStatus(raw: string): SubscriptionStatus {
  const known: Record<string, SubscriptionStatus> = {
    active: "active",
    trialing: "trialing",
    past_due: "past_due",
    incomplete: "incomplete",
    incomplete_expired: "cancelled",
    cancelled: "cancelled",
    unpaid: "past_due",
    paused: "cancelled",
  };
  return known[raw] ?? "unknown";
}

/**
 * Look up subscription state by the correlationRef we set as a cookie
 * before redirecting to Stripe Checkout.
 *
 * Primary path: Sanity (queryable without a Stripe API call).
 * Fallback: Stripe API direct lookup when Sanity isn't configured.
 * Returns `{ status: "unknown" }` when neither source has a record.
 */
export async function getSubscriptionByCorrelationRef(
  correlationRef: string,
): Promise<SubscriptionRecord> {
  if (!correlationRef) return { status: "unknown" };

  // Primary: Sanity subscription document (written by webhook)
  if (sanityWriteClient) {
    try {
      const doc = await sanityWriteClient.fetch<SanitySubscriptionDoc | null>(
        `*[_type == "subscription" && correlationRef == $ref][0] {
          status, plan, currentPeriodEnd, cancelAtPeriodEnd,
          stripeCustomerId, stripeSubscriptionId
        }`,
        { ref: correlationRef },
      );
      if (doc) {
        return {
          status: normaliseSanityStatus(doc.status),
          plan: doc.plan as SubscriptionPlan | undefined,
          currentPeriodEnd: doc.currentPeriodEnd,
          cancelAtPeriodEnd: doc.cancelAtPeriodEnd,
          stripeCustomerId: doc.stripeCustomerId,
          stripeSubscriptionId: doc.stripeSubscriptionId,
        };
      }
    } catch (err) {
      console.error("Subscription entitlement: Sanity query failed:", err);
    }
  }

  return { status: "unknown" };
}

/**
 * Look up subscription state by the Stripe Checkout Session ID.
 * Used on the success page to confirm the session's subscription status
 * without relying on the webhook having already fired.
 *
 * Does NOT grant entitlement — only reports what Stripe's API says. The
 * webhook-written Sanity record is the authoritative entitlement source
 * because it includes idempotency checking and duplicate event protection.
 */
export async function getSubscriptionBySessionId(
  sessionId: string,
): Promise<SubscriptionRecord> {
  if (!stripe || !sessionId) return { status: "unknown" };

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    if (session.mode !== "subscription") return { status: "unknown" };

    const sub = session.subscription;
    if (!sub || typeof sub === "string") {
      // No subscription object yet — the webhook may not have fired.
      return { status: "incomplete" };
    }

    const stripeStatus = sub.status;
    const status: SubscriptionStatus = (() => {
      switch (stripeStatus) {
        case "active":
          return "active";
        case "trialing":
          return "trialing";
        case "past_due":
          return "past_due";
        case "incomplete":
        case "incomplete_expired":
          return "incomplete";
        case "canceled":
          return "cancelled";
        default:
          return "unknown";
      }
    })();

    // current_period_end was removed in Stripe API ≥2025 — omit it here.
    return {
      status,
      stripeCustomerId:
        typeof session.customer === "string" ? session.customer : undefined,
      stripeSubscriptionId: sub.id,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    };
  } catch (err) {
    console.error("Subscription entitlement: Stripe session lookup failed:", err);
    return { status: "unknown" };
  }
}

/**
 * The canonical entitlement question: does this subscription status
 * represent active paid access to Moral Tree Media?
 *
 * ACTIVE and TRIALING are considered access-granting.
 * PAST_DUE is intentionally NOT access-granting here — Stripe's own
 * retry/dunning logic may recover it, but this codebase doesn't grant
 * access speculatively during that window. Override this decision by
 * checking `past_due` separately if a grace period is wanted.
 */
export function hasPaidAccess(status: SubscriptionStatus): boolean {
  return status === "active" || status === "trialing";
}
