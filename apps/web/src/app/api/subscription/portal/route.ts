import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { stripe, isStripeConfigured } from "@/lib/stripe";
import { getSubscriptionByCorrelationRef } from "@/lib/subscriptionEntitlement";
import {
  SUBSCRIPTION_CORRELATION_COOKIE,
} from "@/lib/subscriptionCorrelation";

/**
 * Creates a Stripe Customer Portal session for the authenticated subscriber.
 *
 * Security invariant: the Stripe customer ID is NEVER read from the request
 * body or URL params — it is resolved from the subscriber's httpOnly
 * correlationRef cookie via the trusted Sanity subscription record.
 * The browser cannot forge this; any arbitrary customer ID submitted in the
 * request body is silently ignored.
 *
 * Access model: "has the correlationRef cookie" ≡ "owns this device / was
 * the person who checked out." This is appropriate for a pre-account-system
 * architecture. Once a real account system exists, replace the cookie-based
 * lookup with a session/JWT auth check.
 *
 * POST-only — the manage-billing button submits a form, so this is a
 * standard HTML form POST target, not a JSON API. Redirects to the portal
 * URL on success; redirects to /subscribe with an error on failure.
 */
export async function POST(request: Request) {
  if (!isStripeConfigured || !stripe) {
    return NextResponse.redirect(
      new URL("/subscribe?portal_error=not_configured", request.url),
    );
  }

  // The correlation reference is the sole, server-side-set identifier.
  // It is never accepted from the request body — only from the httpOnly cookie.
  const cookieStore = await cookies();
  const correlationRef = cookieStore.get(SUBSCRIPTION_CORRELATION_COOKIE)?.value;

  if (!correlationRef) {
    return NextResponse.redirect(
      new URL("/subscribe?portal_error=no_session", request.url),
    );
  }

  const subscriptionRecord =
    await getSubscriptionByCorrelationRef(correlationRef);

  if (!subscriptionRecord.stripeCustomerId) {
    console.warn(
      "Subscription portal: no stripeCustomerId found for correlationRef — " +
        "cannot create portal session. Subscription may not yet be confirmed " +
        "by webhook.",
      { correlationRef },
    );
    return NextResponse.redirect(
      new URL("/subscribe?portal_error=not_found", request.url),
    );
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscriptionRecord.stripeCustomerId,
      return_url: `${siteUrl}/subscribe`,
    });

    return NextResponse.redirect(portalSession.url, 303);
  } catch (err) {
    console.error("Stripe Customer Portal session creation failed:", err);
    return NextResponse.redirect(
      new URL("/subscribe?portal_error=stripe_error", request.url),
    );
  }
}
