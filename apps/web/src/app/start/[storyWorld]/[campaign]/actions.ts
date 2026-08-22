"use server";

import { cookies, headers } from "next/headers";
import type { FreeTrialSignupState } from "@/components/patterns/CampaignLanding/actions";
import {
  FIRST_TOUCH_COOKIE_NAME,
  LATEST_TOUCH_COOKIE_NAME,
  parseAttributionCookie,
} from "@/lib/attribution/cookie";
import { buildFallbackAttributionPayload } from "@/lib/attribution/fallback";
import { buildRegistrationConsentState } from "@/lib/registrationConsent";
import { parseAndValidateRegistration } from "@/lib/registration/validate";
import {
  asAcquisitionSourceCode,
  asCampaignId,
  asPartnerId,
  asRewardRuleKey,
  asStoryWorldId,
} from "@/lib/platform/ids";
import { emailStandInPlatformClient } from "@/lib/platform/contract";
import type { OfferIdentity } from "@/lib/platform/contract";
import type { RewardEligibilityMetadata } from "@/lib/rewards/types";

// A "use server" file may only export async functions (Next.js build-
// time rule) — the shared idle initial state
// (`initialFreeTrialSignupState`, `{status: "idle"}`) lives in
// CampaignLanding/actions.ts and is reused directly by this route's
// page.tsx rather than re-declared as a second object export here.

// Same best-effort, single-instance, in-memory rate limiting as
// components/patterns/CampaignLanding/actions.ts and the shop's checkout
// action — same documented caveat (resets on restart, not correct across
// multiple serverless instances under real traffic). Kept as its own map
// — this route is a different abuse surface from `/free30`'s.
const submissionsByIp = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 8;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (submissionsByIp.get(ip) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS,
  );
  recent.push(now);
  submissionsByIp.set(ip, recent);
  return recent.length > RATE_LIMIT_MAX;
}

function optionalString(formData: FormData, name: string): string | undefined {
  const value = String(formData.get(name) || "").trim();
  return value || undefined;
}

function optionalNumber(formData: FormData, name: string): number | undefined {
  const raw = optionalString(formData, name);
  if (raw == null) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

/**
 * The generic `/start/[storyWorld]/[campaign]` route's registration
 * action — everything `components/patterns/CampaignLanding/actions.ts`'s
 * `submitFreeTrialSignup` does (validate the adult registration + consent,
 * honeypot, rate-limit, notify a human via
 * `emailStandInPlatformClient.startTrial` — no real trial provisioning;
 * see that file's own doc comment), but carrying both first-touch and
 * latest-touch attribution (see lib/attribution) plus whatever
 * partner/Story-World/offer identity the campaign's own page.tsx put on
 * the form as hidden fields (see that route's SignupForm props) — this
 * action never re-queries Sanity itself, matching the "actions stay
 * presentational" rule elsewhere in this codebase.
 *
 * Reads the two attribution cookies (already set by `src/proxy.ts` on
 * landing) as the source of truth for `partnerId`/`storyWorldId`/
 * `acquisitionSource`; the hidden `campaign` field (and, in the two
 * cookies' absence, the hidden `partnerId`/`storyWorldId` fields the page
 * also sets) is the fallback for a visitor whose cookies were blocked or
 * cleared between landing and submitting — same "cookie is the source of
 * truth, hidden fields are the fallback" rule the architecture
 * proposal's attribution model describes, not a second, competing
 * source.
 */
export async function submitCampaignSignup(
  _prevState: FreeTrialSignupState,
  formData: FormData,
): Promise<FreeTrialSignupState> {
  // Honeypot — see CampaignLanding/actions.ts for the same pattern/rationale.
  if (formData.get("company")) {
    return {
      status: "success",
      message: "You're on the list — we'll be in touch.",
    };
  }

  const campaignFromForm = String(formData.get("campaign") || "").trim();

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

  if (isRateLimited(ip)) {
    return {
      status: "error",
      message: "Too many submissions — please try again in a few minutes.",
    };
  }

  const cookieStore = await cookies();
  const existingFirst = parseAttributionCookie(
    cookieStore.get(FIRST_TOUCH_COOKIE_NAME)?.value,
  );
  const existingLatest = parseAttributionCookie(
    cookieStore.get(LATEST_TOUCH_COOKIE_NAME)?.value,
  );

  const fallback = buildFallbackAttributionPayload(campaignFromForm);
  const attribution = {
    first: existingFirst ?? fallback,
    latest: existingLatest ?? fallback,
  };

  // Prefer the cookie-derived identifiers (the authoritative source —
  // see this function's own doc comment); fall back to the hidden form
  // fields the page also set from the same Campaign document, for a
  // visitor whose cookies were blocked/cleared.
  const partnerIdRaw =
    attribution.latest.partnerId ?? optionalString(formData, "partnerId");
  const storyWorldIdRaw =
    attribution.latest.storyWorldId ?? optionalString(formData, "storyWorldId");
  const acquisitionSourceRaw =
    attribution.latest.acquisitionSource ?? optionalString(formData, "source");

  const offer: OfferIdentity = {
    offerType: optionalString(formData, "offerType") as
      OfferIdentity["offerType"] | undefined,
    trialLengthDays: optionalNumber(formData, "trialLengthDays"),
    discountPercentage: optionalNumber(formData, "discountPercentage"),
    discountCode: optionalString(formData, "discountCode"),
  };

  const rewardRuleKeyRaw = optionalString(formData, "rewardRuleKey");
  const rewardEligibility: RewardEligibilityMetadata | undefined =
    rewardRuleKeyRaw
      ? {
          rewardRuleKey: asRewardRuleKey(rewardRuleKeyRaw),
          state: "pending",
        }
      : undefined;

  const consent = buildRegistrationConsentState(consentInput);

  const result = await emailStandInPlatformClient.startTrial({
    adult: {
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      country: values.country || undefined,
    },
    campaignId: asCampaignId(campaignFromForm || "unknown"),
    partnerId: partnerIdRaw ? asPartnerId(partnerIdRaw) : undefined,
    storyWorldId: storyWorldIdRaw ? asStoryWorldId(storyWorldIdRaw) : undefined,
    acquisitionSource: acquisitionSourceRaw
      ? asAcquisitionSourceCode(acquisitionSourceRaw)
      : undefined,
    offer,
    attribution,
    consent,
    rewardEligibility,
  });

  if (result.status === "error") {
    return { status: "error", message: result.message };
  }

  return { status: "success", message: result.message };
}
