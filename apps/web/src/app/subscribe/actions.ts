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
 * Creates a Stripe Checkout Session for a subscription, sets the
 * correlation cookie, and redirects to the Stripe-hosted Checkout URL.
 *
 * Security invariant: the browser submits only an internal plan identifier
 * ("MONTHLY"/"ANNUAL"). The server maps it to the configured Stripe Price
 * ID — the browser never sees or supplies a real Price ID. A tampered
 * plan value that isn't one of the two valid identifiers is rejected before
 * any Stripe API call is made.
 *
 * Attribution: reads attribution cookies (set by src/proxy.ts at campaign
 * landing) and forwards them as Stripe metadata, so paid conversions
 * remain attributable through to the webhook-confirmed subscription.
 *
 * Returns an error state for field/config problems. On success, redirects
 * to Stripe (never returns to the caller — Next.js redirect() throws).
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

  // Stable correlation reference — generated server-side, set as a cookie,
  // and passed as client_reference_id to Stripe. The webhook uses this to
  // write the subscription record without trusting any client input.
  const correlationRef = crypto.randomUUID();

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  // Trial period configuration — zero/unset means no trial (card charged
  // immediately). Configurable via STRIPE_TRIAL_PERIOD_DAYS; default is
  // no trial for paid subscriptions (the existing /free30 email-notification
  // trial is a separate, manual-follow-up flow — see lib/platform/contract.ts).
  // FOUNDER DECISION REQUIRED: if a Stripe-managed free trial (card
  // required upfront, automatic conversion) is wanted, set
  // STRIPE_TRIAL_PERIOD_DAYS to the desired number of days and notify
  // customers of the automatic conversion at checkout.
  const trialPeriodDays = process.env.STRIPE_TRIAL_PERIOD_DAYS
    ? parseInt(process.env.STRIPE_TRIAL_PERIOD_DAYS, 10) || 0
    : 0;

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
      // Attribution + plan metadata forwarded to the subscription
      // itself so lifecycle events (renewal, cancellation) remain
      // attributable without a second Sanity lookup.
      metadata: {
        checkoutType: "subscription",
        plan,
        correlationRef,
        firstName,
        lastName,
        ...(latestAttribution?.campaignId && {
          campaignId: latestAttribution.campaignId,
        }),
        ...(latestAttribution?.acquisitionSource && {
          acquisitionSource: latestAttribution.acquisitionSource,
        }),
        ...(latestAttribution?.partnerId && {
          partnerId: latestAttribution.partnerId,
        }),
        ...(latestAttribution?.storyWorldId && {
          storyWorldId: latestAttribution.storyWorldId,
        }),
      },
      subscription_data: {
        metadata: {
          checkoutType: "subscription",
          plan,
          correlationRef,
          ...(latestAttribution?.campaignId && {
            campaignId: latestAttribution.campaignId,
          }),
          ...(latestAttribution?.acquisitionSource && {
            acquisitionSource: latestAttribution.acquisitionSource,
          }),
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
        ...(trialPeriodDays > 0 && { trial_period_days: trialPeriodDays }),
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
