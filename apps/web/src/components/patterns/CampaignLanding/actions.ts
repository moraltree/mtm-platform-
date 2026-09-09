"use server";

import { cookies, headers } from "next/headers";
import { buildFallbackAttributionPayload } from "@/lib/attribution/fallback";
import { buildRegistrationConsentState } from "@/lib/registrationConsent";
import { parseAndValidateRegistration } from "@/lib/registration/validate";
import { asAcquisitionSourceCode, asCampaignId } from "@/lib/platform/ids";
import { emailStandInPlatformClient } from "@/lib/platform/contract";
import { isRegistrationRateLimited } from "@/lib/registration/rateLimit";
import { registerPlatformTrial } from "@/lib/trialRegistration";
import {
  SUBSCRIPTION_CORRELATION_COOKIE,
  CORRELATION_COOKIE_OPTIONS,
} from "@/lib/subscriptionCorrelation";
import type { FreeTrialSignupState } from "./state";

/**
 * Registers an adult (parent/legal guardian) for the free 30-day trial
 * and provisions a platform-managed trial record in Sanity.
 *
 * NO CARD REQUIRED — this action creates a trial entitlement without any
 * Stripe interaction. Payment is only collected if and when the customer
 * explicitly chooses a paid subscription at /subscribe.
 *
 * NO AUTO-CONVERSION — when the 30-day trial expires, access simply ends.
 * The customer is never automatically charged.
 *
 * STARTER COLLECTION ONLY — the trial grants access to a curated subset
 * of content, not the full library. Full library access requires a paid
 * subscription.
 *
 * On success:
 *   1. A Sanity subscription document is created with status="trialing".
 *   2. The mtm_sub_ref correlation cookie is set (httpOnly) so the trial
 *      entitlement is readable on subsequent requests.
 *   3. An email notification is sent to the operator inbox (best-effort —
 *      does not block on failure).
 */
export async function submitFreeTrialSignup(
  _prevState: FreeTrialSignupState,
  formData: FormData,
): Promise<FreeTrialSignupState> {
  // Honeypot — see ContactForm/actions.ts for the same pattern/rationale.
  if (formData.get("company")) {
    return {
      status: "success",
      message: "You're on the list — we'll be in touch.",
    };
  }

  const campaign = String(formData.get("campaign") || "").trim() || "unknown";
  const source = String(formData.get("source") || "").trim();

  const { values, consentInput, fieldErrors, consentErrors, isValid } =
    parseAndValidateRegistration(formData);

  if (!isValid) {
    return {
      status: "error",
      fieldErrors,
      consentErrors,
      message: "Please fix the errors below.",
    };
  }

  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";

  if (isRegistrationRateLimited(ip)) {
    return {
      status: "error",
      message: "Too many submissions — please try again in a few minutes.",
    };
  }

  // Provision the platform trial — creates the Sanity record.
  const trialResult = await registerPlatformTrial(values.email, {
    campaignId: campaign !== "unknown" ? campaign : undefined,
    acquisitionSource: source || undefined,
  });

  if (!trialResult.success) {
    if (trialResult.reason === "already_registered") {
      return {
        status: "error",
        message:
          "It looks like a free trial has already been started with this email address. " +
          "If you'd like to subscribe, visit our subscription page.",
      };
    }
    // sanity_unavailable or generic error — don't expose internal details.
    return {
      status: "error",
      message:
        "We couldn't start your trial right now — please try again in a moment. " +
        "If this keeps happening, please contact us.",
    };
  }

  // Set the correlation cookie so subsequent entitlement checks pick up this trial.
  try {
    const cookieStore = await cookies();
    cookieStore.set(
      SUBSCRIPTION_CORRELATION_COOKIE,
      trialResult.record.correlationRef,
      CORRELATION_COOKIE_OPTIONS,
    );
  } catch {
    // Cookie setting may fail in edge cases; log but don't block the response.
    // The Sanity record is the authoritative source — the cookie is a
    // convenience for the current device session.
    console.warn(
      "Free trial signup: could not set correlation cookie — trial still registered in Sanity.",
    );
  }

  // Best-effort operator notification — lets the human team see signups.
  // Failure here does not affect trial provisioning.
  try {
    const fallback = buildFallbackAttributionPayload(campaign);
    const attribution = { first: fallback, latest: fallback };
    const consent = buildRegistrationConsentState(consentInput);
    await emailStandInPlatformClient.startTrial({
      adult: {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        country: values.country || undefined,
      },
      campaignId: asCampaignId(campaign),
      acquisitionSource: source ? asAcquisitionSourceCode(source) : undefined,
      offer: { offerType: "free-trial", trialLengthDays: 30 },
      attribution,
      consent,
    });
  } catch {
    // Email notification failure must not fail the user-facing action.
    console.error(
      "Free trial signup: operator notification email failed — trial still active.",
    );
  }

  return {
    status: "success",
    message:
      "Your 30-day free trial has started! You now have access to the Starter Collection.",
  };
}
