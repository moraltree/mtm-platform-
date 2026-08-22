"use server";

import { headers } from "next/headers";
import { buildFallbackAttributionPayload } from "@/lib/attribution/fallback";
import { buildRegistrationConsentState } from "@/lib/registrationConsent";
import {
  parseAndValidateRegistration,
  type RegistrationFieldErrors,
} from "@/lib/registration/validate";
import type { RegistrationConsentErrors } from "@/lib/registrationConsent";
import { asAcquisitionSourceCode, asCampaignId } from "@/lib/platform/ids";
import { emailStandInPlatformClient } from "@/lib/platform/contract";
import { isRegistrationRateLimited } from "@/lib/registration/rateLimit";

export interface FreeTrialSignupState {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: RegistrationFieldErrors;
  consentErrors?: RegistrationConsentErrors;
}

export const initialFreeTrialSignupState: FreeTrialSignupState = {
  status: "idle",
};

/**
 * Captures an adult registration (parent/legal guardian — see the
 * required confirmations below) for the free-30-night trial and
 * notifies a human inbox via `emailStandInPlatformClient.startTrial` —
 * it does **not** provision an actual trial (create an account, grant
 * audiobook access, or send the first story). No such system exists
 * anywhere in this codebase yet (no customer accounts, no
 * content-delivery/CRM integration — see CLAUDE.md), and inventing one
 * here would be exactly the kind of fabricated production behaviour this
 * project's brief says to stop short of.
 *
 * `/free30` predates the attribution-cookie system (`src/proxy.ts` only
 * writes cookies on `/start/[storyWorld]/[campaign]` landings) and isn't
 * Sanity-backed, so there's no Partner/Story-World/offer document to
 * read here — this route's own hard-coded "30 nights free" identity is
 * passed as the offer, and attribution falls back to whatever the
 * hidden `campaign`/`source` fields carried (see
 * `buildFallbackAttributionPayload`), same honest-minimum rule
 * `/start/...`'s own action already established.
 *
 * Inert-until-configured, same contract as ContactForm/actions.ts and the
 * Stripe webhook: unset `RESEND_API_KEY`/`FREE_TRIAL_TO_EMAIL` means the
 * page still works end-to-end (validation, honeypot, rate limiting) but
 * the submission is rejected with an honest message instead of silently
 * vanishing or falsely claiming a trial has started.
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

  const fallback = buildFallbackAttributionPayload(campaign);
  const attribution = { first: fallback, latest: fallback };
  const consent = buildRegistrationConsentState(consentInput);

  const result = await emailStandInPlatformClient.startTrial({
    adult: {
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      country: values.country || undefined,
    },
    campaignId: asCampaignId(campaign),
    acquisitionSource: source ? asAcquisitionSourceCode(source) : undefined,
    // /free30 is not Sanity-backed (see this file's doc comment) — its
    // own always-on identity is "30 nights free", not a configurable
    // Campaign document's offer.
    offer: { offerType: "free-trial", trialLengthDays: 30 },
    attribution,
    consent,
  });

  if (result.status === "error") {
    return { status: "error", message: result.message };
  }

  return { status: "success", message: result.message };
}
