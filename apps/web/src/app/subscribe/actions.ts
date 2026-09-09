"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { stripe, isStripeConfigured } from "@/lib/stripe";
import {
  isValidPlan,
  getPriceIdForPlan,
  type SubscriptionPlan,
} from "@/lib/subscriptionPlans";
import { isValidEmail } from "@/lib/email";
import {
  SUBSCRIPTION_CORRELATION_COOKIE,
  CORRELATION_COOKIE_OPTIONS,
} from "@/lib/subscriptionCorrelation";
import {
  FIRST_TOUCH_COOKIE_NAME,
  LATEST_TOUCH_COOKIE_NAME,
  parseAttributionCookie,
} from "@/lib/attribution/cookie";
import type { SubscribeCheckoutState } from "./state";

// Best-effort, single-instance rate limiting — same caveat as
// ContactForm and checkout/actions.ts: resets on restart, no shared
// store across serverless instances yet.
const attemptsByIp = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (attemptsByIp.get(ip) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS,
  );
  recent.push(now);
  attemptsByIp.set(ip, recent);
  return recent.length > RATE_LIMIT_MAX;
}

/**
 * Creates a Stripe Checkout Session for a paid subscription, sets the
 * correlation cookie, and redirects to the Stripe-hosted Checkout URL.
 *
 * PAID SUBSCRIPTION ONLY — no free trial period.
 * The free trial is a separate platform-managed offering registered at
 * /free30. This checkout always charges immediately on Stripe — no
 * trial_period_days, no deferred billing, no card-free path.
 *
 * A customer upgrading from a free trial goes through this same checkout.
 * Stripe charges immediately. The paid subscription start date becomes the
 * billing/renewal anchor. No unused trial days are credited or carried
 * forward — the policy is explicit: upgrade ends the trial on the spot.
 *
 * SECURITY INVARIANTS
 * - The browser submits only an internal plan identifier ("MONTHLY"/"ANNUAL").
 *   The server maps it to the configured Stripe Price ID — never trusts a
 *   client-supplied Price ID.
 * - No trial duration is accepted from the browser under any circumstances.
 * - Attribution reads attribution cookies and forwards them as Stripe metadata
 *   so paid conversions remain attributable through to the webhook-confirmed
 *   subscription record.
 *
 * A paid conversion is confirmed only by the invoice.paid webhook event.
 */
export async function createSubscriptionCheckout(
  _prevState: SubscribeCheckoutState,
  formData: FormData,
): Promise<SubscribeCheckoutState> {
  if (!isStripeConfigured || !stripe) {
    return {
      status: "error",
      message:
        "Subscription checkout isn't fully set up yet — please try again later.",
    };
  }

  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  if (isRateLimited(ip)) {
    return {
      status: "error",
      message: "Too many attempts — please try again in a few minutes.",
    };
  }

  // Validate plan — the ONLY Stripe-specific value the browser submits.
  const planRaw = String(formData.get("plan") ?? "").trim();
  if (!isValidPlan(planRaw)) {
    return {
      status: "error",
      message: "Please select a subscription plan.",
      fieldErrors: { plan: "Please select a plan." },
    };
  }
  const plan = planRaw as SubscriptionPlan;

  const priceId = getPriceIdForPlan(plan);
  if (!priceId) {
    return {
      status: "error",
      message:
        "This subscription plan isn't available yet — please try again later.",
    };
  }

  // Validate identity fields — prefilled into Stripe's form but Stripe
  // re-validates them; we validate here too for immediate user feedback.
  const firstName = String(formData.get("firstName") ?? "").trim().slice(0, 100);
  const lastName = String(formData.get("lastName") ?? "").trim().slice(0, 100);
  const email = String(formData.get("email") ?? "").trim().slice(0, 254);

  const fieldErrors: SubscribeCheckoutState["fieldErrors"] = {};
  if (!firstName) fieldErrors.firstName = "First name is required.";
  if (!lastName) fieldErrors.lastName = "Last name is required.";
  if (!email) {
    fieldErrors.email = "Email address is required.";
  } else if (!isValidEmail(email)) {
    fieldErrors.email = "Please enter a valid email address.";
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { status: "error", message: "Please fix the errors below.", fieldErrors };
  }

  // Read attribution cookies (set at campaign landing, never from the form).
  const cookieStore = await cookies();
  const latestAttribution = parseAttributionCookie(
    cookieStore.get(LATEST_TOUCH_COOKIE_NAME)?.value,
  );
  const firstAttribution = parseAttributionCookie(
    cookieStore.get(FIRST_TOUCH_COOKIE_NAME)?.value,
  );

  const campaignId = latestAttribution?.campaignId ?? undefined;
  const acquisitionSource = latestAttribution?.acquisitionSource ?? undefined;

  // Stable correlation reference — generated server-side, set as a cookie,
  // and passed as client_reference_id to Stripe. The webhook uses this to
  // write the subscription record without trusting any client input.
  const correlationRef = crypto.randomUUID();

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      // Pre-fill the customer's details in the Stripe-hosted form.
      customer_email: email,
      // Stable internal correlation — the webhook reads this back and
      // stores it in the subscription document. Never a Stripe ID.
      client_reference_id: correlationRef,
      // Attribution metadata forwarded to the subscription itself so
      // lifecycle events (renewal, cancellation) remain attributable
      // without a second Sanity lookup.
      metadata: {
        checkoutType: "subscription",
        plan,
        correlationRef,
        firstName,
        lastName,
        ...(campaignId && { campaignId }),
        ...(acquisitionSource && { acquisitionSource }),
        ...(latestAttribution?.partnerId && {
          partnerId: latestAttribution.partnerId,
        }),
        ...(latestAttribution?.storyWorldId && {
          storyWorldId: latestAttribution.storyWorldId,
        }),
      },
      subscription_data: {
        // No trial_period_days — this checkout always charges immediately.
        // The free trial is a separate platform-managed offering at /free30.
        // Customers upgrading from a trial pay immediately; no unused trial
        // days are carried forward.
        metadata: {
          checkoutType: "subscription",
          plan,
          correlationRef,
          ...(campaignId && { campaignId }),
          ...(acquisitionSource && { acquisitionSource }),
          ...(latestAttribution?.partnerId && {
            partnerId: latestAttribution.partnerId,
          }),
          ...(latestAttribution?.storyWorldId && {
            storyWorldId: latestAttribution.storyWorldId,
          }),
          ...(firstAttribution?.attributionRef && {
            firstTouchRef: firstAttribution.attributionRef,
          }),
        },
      },
      success_url: `${siteUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/subscription/cancelled`,
      billing_address_collection: "auto",
    });
  } catch (err) {
    console.error("Stripe subscription checkout session creation failed:", err);
    return {
      status: "error",
      message: "Something went wrong starting checkout — please try again.",
    };
  }

  if (!session.url) {
    return {
      status: "error",
      message: "Something went wrong starting checkout — please try again.",
    };
  }

  // Set the correlation cookie before redirecting — this is the only
  // window where both the correlationRef and a cookie write are possible
  // in the same request. The cookie is httpOnly so client JavaScript
  // cannot read or forge it.
  cookieStore.set(
    SUBSCRIPTION_CORRELATION_COOKIE,
    correlationRef,
    CORRELATION_COOKIE_OPTIONS,
  );

  // redirect() throws — no return after this line.
  redirect(session.url);
}
