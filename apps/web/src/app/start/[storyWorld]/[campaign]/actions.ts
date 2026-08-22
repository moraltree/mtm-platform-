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
  asPartnerId,
  asRewardRuleKey,
  asStoryWorldId,
} from "@/lib/platform/ids";
import {
  emailStandInPlatformClient,
  isOfferType,
} from "@/lib/platform/contract";
import type { OfferIdentity } from "@/lib/platform/contract";
import type { RewardEligibilityMetadata } from "@/lib/rewards/types";
import { isRegistrationRateLimited } from "@/lib/registration/rateLimit";

// A "use server" file may only export async functions (Next.js build-
// time rule) — the shared idle initial state
// (`initialFreeTrialSignupState`, `{status: "idle"}`) lives in
// CampaignLanding/actions.ts and is reused directly by this route's
// page.tsx rather than re-declared as a second object export here.

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

  if (isRegistrationRateLimited(ip)) {
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

  // `offerType` arrives via a client-editable hidden field, so it's
  // validated against the real union rather than cast — an unrecognised
  // value (tampered, or just stale after a future offer type is added)
  // is dropped to `undefined` rather than smuggled through as an
  // unchecked string (see isOfferType's own doc comment).
  const offerTypeRaw = optionalString(formData, "offerType");
  const offer: OfferIdentity = {
    offerType:
      offerTypeRaw && isOfferType(offerTypeRaw) ? offerTypeRaw : undefined,
    trialLengthDays: optionalNumber(formData, "trialLengthDays"),
    discountPercentage: optionalNumber(formData, "discountPercentage"),
    fixedOfferLabel: optionalString(formData, "fixedOfferLabel"),
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
    // The cookie-derived value (via `attribution.latest`, which
    // `buildFallbackAttributionPayload` already seeds from
    // `campaignFromForm` when no cookie exists) is authoritative — same
    // "cookie wins, hidden field is only the fallback that feeds it"
    // rule this function's own doc comment describes for
    // partner/Story-World/acquisition-source, now applied consistently
    // to campaignId too rather than reading the tamperable hidden field
    // a second, competing time.
    campaignId: attribution.latest.campaignId,
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
